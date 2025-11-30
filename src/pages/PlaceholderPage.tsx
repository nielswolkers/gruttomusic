import { useLocation } from 'react-router-dom';

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-foreground mb-4">{pageName}</h1>
        <p className="text-muted-foreground">Deze pagina is in ontwikkeling...</p>
      </div>
    </div>
  );
}
