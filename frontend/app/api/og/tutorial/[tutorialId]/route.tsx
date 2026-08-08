import { ImageResponse } from 'next/og';
import { getTutorialById } from '@/data/tutorials';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tutorialId: string }> }
) {
  const { tutorialId } = await params;
  const tutorial = getTutorialById(tutorialId);

  if (!tutorial) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#94a3b8',
            fontSize: 32,
          }}
        >
          Tutorial not found
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const stepCount = tutorial.levels.reduce((acc, l) => acc + l.steps.length, 0);
  const accent = tutorial.color ?? '#595959';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: accent,
            }}
          />
          <span style={{ color: '#94a3b8', fontSize: 22, fontWeight: 600 }}>ArchDraw Tutorials</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ color: '#f8fafc', fontSize: 48, fontWeight: 700, lineHeight: 1.15 }}>
            {tutorial.title}
          </span>
          <span style={{ color: '#cbd5e1', fontSize: 22, lineHeight: 1.4, maxWidth: 900 }}>
            {tutorial.description}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, color: '#94a3b8', fontSize: 18 }}>
          <span>{tutorial.difficulty}</span>
          <span>·</span>
          <span>{stepCount} steps</span>
          <span>·</span>
          <span>{tutorial.estimatedMinutes} min</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
