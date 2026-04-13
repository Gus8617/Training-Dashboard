import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const user = JSON.parse(localStorage.getItem('temp_user')); // Récupéré lors de l'étape 1

    if (code && user) {
      fetch('/api/auth/strava-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          userId: user.id,
          client_id: user.client_id,
          client_secret: user.client_secret
        })
      }).then(() => navigate('/dashboard'));
    }
  }, []);

  return <div className="text-white text-center mt-20">Liaison avec Strava en cours...</div>;
}