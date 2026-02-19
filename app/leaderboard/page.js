import LeaderboardView from './LeaderboardView';

export default function LeaderboardPage() {
  return (
    <main style={{
      minHeight: '100vh',
      padding: 32,
      background: '#08081a',
      color: '#e9d5ff',
      fontFamily: 'Courier New, monospace'
    }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <LeaderboardView />
      </div>
    </main>
  );
}
