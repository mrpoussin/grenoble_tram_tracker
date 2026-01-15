import { NextResponse } from 'next/server';

const GRENOBLE_INSEE = '38185';
const API_BASE = 'https://data.mobilites-m.fr/api';

export async function GET() {
  try {
    const response = await fetch(
      `${API_BASE}/dyn/indiceAtmoCommunal/${GRENOBLE_INSEE}/json`,
      {
        headers: {
          Origin: 'https://www.mobilites-m.fr',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch air quality' }, { status: 500 });
    }

    const data = await response.json();
    
    // Extract today's index and tomorrow's forecast
    const indices = data.indices || [];
    const today = indices.find((i: { echeance: number }) => i.echeance === 0);
    const tomorrow = indices.find((i: { echeance: number }) => i.echeance === 1);
    
    return NextResponse.json({
      today: today ? {
        index: today.indice,
        quality: today.qualificatif,
        color: today.couleur_html,
        pollutants: today.polluants_majoritaires,
        subIndices: today.sous_indices,
      } : null,
      tomorrow: tomorrow ? {
        index: tomorrow.indice,
        quality: tomorrow.qualificatif,
        color: tomorrow.couleur_html,
      } : null,
      comment: data.commentaire || null,
      definitions: data.definitions || [],
    });
  } catch (error) {
    console.error('Air quality API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
