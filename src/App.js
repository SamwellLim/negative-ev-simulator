import React, { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chart.js/auto';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

function App() {
  const [maxGames, setMaxGames] = useState(1000);        
  const [playersPerP, setPlayersPerP] = useState(1000); 
  const [startingBankroll, setStartingBankroll] = useState(100);
  const [strategy, setStrategy] = useState('flat');
  const [flatBetAmount, setFlatBetAmount] = useState(5); 
  const [kellyFraction, setKellyFraction] = useState(20); 
  const [results, setResults] = useState(null);
  const [selectedPIndex, setSelectedPIndex] = useState(0); // For histogram

  const simulatePlayer = (maxGames, p, strategy, flatAmount, kellyF, initialBankroll) => {
    let bankroll = initialBankroll;
    let gamesPlayed = 0;

    while (gamesPlayed < maxGames && bankroll > 0) {
      let bet = 0;

      if (strategy === 'bold') {
        bet = bankroll; // All in
      } else if (strategy === 'flat') {
        bet = Math.min(flatAmount, bankroll);
      } else if (strategy === 'kelly') {
        const targetBet = (kellyF / 100) * bankroll;
        // Minimum meaningful bet: at least $1, or whatever is left
        bet = Math.max(1, Math.floor(targetBet));
        bet = Math.min(bet, bankroll);
      }

      if (bet <= 0) break; // Safety

      const win = Math.random() < p;
      if (win) {
        bankroll += bet; 
      } else {
        bankroll -= bet;
      }

      gamesPlayed++;
    }

    return bankroll;
  };

  const runSimulation = () => {
    const pValues = [];
    for (let i = 1; i <= 49; i++) pValues.push(i / 100);

    const simulationResults = pValues.map(p => {
      const variance = 4 * p * (1 - p);
      const finalBankrolls = [];

      for (let j = 0; j < playersPerP; j++) {
        finalBankrolls.push(
          simulatePlayer(
            maxGames,
            p,
            strategy,
            flatBetAmount,
            kellyFraction,
            startingBankroll
          )
        );
      }

      finalBankrolls.sort((a, b) => a - b);

      const fractionPositive = finalBankrolls.filter(b => b > startingBankroll).length / playersPerP;
      const fractionRuined = finalBankrolls.filter(b => b === 0).length / playersPerP;
      const p50 = finalBankrolls[Math.floor(0.50 * (playersPerP - 1))];
      const p90 = finalBankrolls[Math.floor(0.90 * (playersPerP - 1))];
      const p99 = finalBankrolls[Math.floor(0.99 * (playersPerP - 1))];
      const average = finalBankrolls.reduce((a, b) => a + b, 0) / playersPerP;

      return {
        p,
        variance,
        fractionPositive,
        fractionRuined,
        p50,
        p90,
        p99,
        average,
        finalBankrolls, // Store for histogram
      };
    });

    setResults(simulationResults);
  };

  const makeChart = (xKey, xLabel, datasets) => ({
    labels: results?.map(r => r[xKey]) || [],
    datasets,
  });

  const chartOptions = (xTitle, yTitle, yMin = 0) => ({
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { title: { display: true, text: xTitle } },
      y: { title: { display: true, text: yTitle }, min: yMin },
    },
  });

  const currentStrategyName = () => {
    if (strategy === 'bold') return 'Bold Play (Bet All)';
    if (strategy === 'flat') return `Flat $${flatBetAmount} Bet`;
    return `Kelly (${kellyFraction}% of bankroll)`;
  };

  // Histogram and Pareto functions
  const getBins = (bankrolls) => {
    const binEdges = [0, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, Infinity];
    const bins = new Array(binEdges.length - 1).fill(0);

    bankrolls.forEach(b => {
      for (let i = 0; i < binEdges.length - 1; i++) {
        if (b >= binEdges[i] && b < binEdges[i + 1]) {
          bins[i]++;
          break;
        }
      }
    });

    const labels = binEdges.slice(0, -1).map((low, i) => {
      const high = binEdges[i + 1] === Infinity ? '∞' : binEdges[i + 1] - 1;
      return `${low}-${high}`;
    });

    return { labels, bins };
  };

  const fitParetoAndGenerate = (bankrolls, binLabels, totalPlayers) => {
    const positive = bankrolls.filter(b => b > 0);
    if (positive.length < 2) return new Array(binLabels.length).fill(0);

    const xm = Math.min(...positive);
    const n = positive.length;
    const sumLog = positive.reduce((sum, x) => sum + Math.log(x / xm), 0);
    const alpha = n / sumLog;

    // Generate Pareto y for midpoints of bins (scaled to count)
    const midPoints = binLabels.map(label => {
      const [low, high] = label.split('-').map(Number);
      return (low + (isNaN(high) ? low + 10000 : high)) / 2; // Approximate for infinity
    });

    const paretoY = midPoints.map(x => {
      if (x < xm) return 0;
      return alpha * Math.pow(xm, alpha) / Math.pow(x, alpha + 1) * totalPlayers; // PDF * n
    });

    return paretoY;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Negative EV Game: Betting Strategies & Gambler's Ruin</h1>
      <p style={{ color: '#d32f2f' }}>
        <strong>All games have negative EV (p ≤ 0.49). Long-term ruin is certain.</strong>
      </p>

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label>Starting Bankroll ($): </label>
          <input
            type="number"
            min="10"
            value={startingBankroll}
            onChange={e => setStartingBankroll(Math.max(10, parseInt(e.target.value) || 100))}
            style={{ width: '100px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Max Games per Player: </label>
          <input
            type="number"
            value={maxGames}
            onChange={e => setMaxGames(parseInt(e.target.value) || 1000)}
            style={{ width: '100px', marginLeft: '10px' }}
          />

          <label style={{ marginLeft: '30px' }}>Players per p value: </label>
          <input
            type="number"
            value={playersPerP}
            onChange={e => setPlayersPerP(parseInt(e.target.value) || 1000)}
            style={{ width: '100px', marginLeft: '10px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Betting Strategy: </label>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
            style={{ padding: '8px', marginLeft: '10px' }}
          >
            <option value="bold">Bold Play (Bet All)</option>
            <option value="flat">Flat Fixed Bet</option>
            <option value="kelly">Kelly Proportional</option>
          </select>
        </div>

        {strategy === 'flat' && (
          <div style={{ marginTop: '15px' }}>
            <label>Flat Bet Amount ($): </label>
            <input
              type="number"
              value={flatBetAmount}
              onChange={e => setFlatBetAmount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '120px', padding: '8px', marginLeft: '10px' }}
            />
            <span style={{ marginLeft: '10px', color: '#555' }}>
              Current: ${flatBetAmount}
            </span>
          </div>
        )}

        {strategy === 'kelly' && (
          <div style={{ marginTop: '10px' }}>
            <label>Kelly Fraction (% of current bankroll): {kellyFraction}% </label>
            <input
              type="range"
              min="1"
              max="100"
              value={kellyFraction}
              onChange={e => setKellyFraction(parseInt(e.target.value))}
              style={{ width: '300px', marginLeft: '10px' }}
            />
            <p style={{ color: '#d32f2f', fontSize: '0.9em' }}>
              Note: Optimal Kelly for fair coin (p=0.5) is 100%(p-1)=0, but here EV&lt;0 → optimal f=0 (don't play).
            </p>
          </div>
        )}

        <button
          onClick={runSimulation}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            fontSize: '1.1em',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Run Simulation
        </button>
      </div>

      {results && (
        <>
          <h2>Results: {currentStrategyName()}</h2>
          <p>Starting bankroll: ${startingBankroll} | Max games: {maxGames}</p>

          <h3>1. Fraction Ending Ahead (> Starting Bankroll)</h3>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('p', 'Win Probability p', [{
                  label: 'Fraction Ahead',
                  data: results.map(r => r.fractionPositive),
                  borderColor: 'rgb(76, 175, 80)',
                  backgroundColor: 'rgba(76, 175, 80, 0.2)',
                }])}
                options={chartOptions('Win Probability p', 'Fraction Ahead', 0)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('variance', 'Variance σ²', [{
                  label: 'Fraction Ahead',
                  data: results.map(r => r.fractionPositive),
                  borderColor: 'rgb(76, 175, 80)',
                }])}
                options={{
                  ...chartOptions('Variance σ² = 4p(1-p)', 'Fraction Ahead', 0),
                  scales: { x: { min: 0, max: 1.05, ticks: { stepSize: 0.1 } } },
                }}
              />
            </div>
          </div>

          <h3 style={{ marginTop: '50px' }}>2. Fraction Ruined (Bankroll = $0)</h3>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('p', 'Win Probability p', [{
                  label: 'Fraction Ruined',
                  data: results.map(r => r.fractionRuined),
                  borderColor: 'rgb(211, 47, 47)',
                }])}
                options={chartOptions('Win Probability p', 'Fraction Ruined', 0)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('variance', 'Variance σ²', [{
                  label: 'Fraction Ruined',
                  data: results.map(r => r.fractionRuined),
                  borderColor: 'rgb(211, 47, 47)',
                }])}
                options={chartOptions('Variance σ²', 'Fraction Ruined', 0)}
              />
            </div>
          </div>

          <h3 style={{ marginTop: '50px' }}>3. Final Bankroll at Key Percentiles</h3>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('p', 'Win Probability p', [
                  { label: '99th Percentile (Top 1%)', data: results.map(r => r.p99), borderColor: '#ff9800' },
                  { label: '90th Percentile (Top 10%)', data: results.map(r => r.p90), borderColor: '#f44336' },
                  { label: 'Median (50th)', data: results.map(r => r.p50), borderColor: '#2196f3' },
                ])}
                options={chartOptions('Win Probability p', 'Final Bankroll ($)')}
              />
            </div>
            <div style={{ flex: 1, minWidth: '450px' }}>
              <Line
                data={makeChart('variance', 'Variance σ²', [
                  { label: '99th Percentile', data: results.map(r => r.p99), borderColor: '#ff9800' },
                  { label: '90th Percentile', data: results.map(r => r.p90), borderColor: '#f44336' },
                  { label: 'Median', data: results.map(r => r.p50), borderColor: '#2196f3' },
                ])}
                options={chartOptions('Variance σ²', 'Final Bankroll ($)')}
              />
            </div>
          </div>

          <h3 style={{ marginTop: '60px' }}>4. Final Bankroll Distribution</h3>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>
              Win Probability (p): {results && results[selectedPIndex]?.p.toFixed(2)} 
              {' '} (variance = {results && results[selectedPIndex]?.variance.toFixed(3)})
            </label>
            <div style={{ width: '80%', maxWidth: '600px', margin: '10px auto' }}>
              <input
                type="range"
                min="0"
                max={results ? results.length - 1 : 0}
                value={selectedPIndex}
                onChange={e => setSelectedPIndex(parseInt(e.target.value))}
                style={{ width: '100%', height: '8px', borderRadius: '5px', background: '#d3d3d3', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#555' }}>
              <span>p = 0.01</span>
              <span>p = 0.49</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <div style={{ width: '80%', maxWidth: '800px' }}>
              <Bar
                data={{
                  labels: getBins(results[selectedPIndex].finalBankrolls).labels,
                  datasets: [
                    {
                      type: 'bar',
                      label: 'Player Count',
                      data: getBins(results[selectedPIndex].finalBankrolls).bins,
                      backgroundColor: 'rgba(54, 162, 235, 0.6)',
                      yAxisID: 'y',
                    },
                    {
                      type: 'line',
                      label: 'Pareto Fit',
                      data: fitParetoAndGenerate(results[selectedPIndex].finalBankrolls, getBins(results[selectedPIndex].finalBankrolls).labels, playersPerP),
                      borderColor: 'rgb(255, 99, 132)',
                      borderWidth: 2,
                      fill: false,
                      tension: 0.1,
                      yAxisID: 'y',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'top' },
                  },
                  scales: {
                    x: { title: { display: true, text: 'Final Bankroll ($)' } },
                    y: { title: { display: true, text: 'Count' }, min: 0 },
                  },
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: '40px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
            <p><strong>Key Takeaway:</strong> Higher variance creates more short-term winners and spectacular top performers — especially with aggressive strategies — despite guaranteed long-term ruin.</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;