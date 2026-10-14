import { CustomNodeIcon } from '@/lib/icons/CustomNodeIcon';
import { DIAGRAM_THEMES } from '@/lib/theme/stylingConstants';
import { metallicSurfaceGradientSvgDefs } from '@/lib/theme/renderStyles/studioMetallic';
import styles from './HeroSouvenirs.module.css';

/**
 * Diagram keepsakes peeking over the top edge of the hero's map window:
 * the canvas's own shapes (cylinder, decision diamond, hexagon) and a Mermaid
 * snippet, in the Studio Metallic finish. Decorative only.
 */

const STUDIO = DIAGRAM_THEMES['studio-minimal'];
const FILL = STUDIO.dark.nodeFill;
const DATA = STUDIO.concerns.data.darkColor ?? STUDIO.concerns.data.color;
const COMPUTE = STUDIO.concerns.compute.darkColor ?? STUDIO.concerns.compute.color;
// Same gradients as the canvas, under ids of their own.
const DEFS = metallicSurfaceGradientSvgDefs(true).replaceAll('archdraw-metallic', 'souvenir-metallic');

function Metal({ d, stroke }: { d: string; stroke: string }) {
  return (
    <>
      <path d={d} fill={FILL} filter="url(#souvenir-metallic-shadow)" transform="translate(0 2)" />
      <path d={d} fill={FILL} stroke={stroke} strokeOpacity={0.55} strokeWidth={1.3} />
      <path d={d} fill="url(#souvenir-metallic-sheen)" />
      <path d={d} fill="url(#souvenir-metallic-edge)" />
    </>
  );
}

export function HeroSouvenirs() {
  return (
    <div className={styles.shelf} aria-hidden="true">
      <svg width="0" height="0" className={styles.defs}><g dangerouslySetInnerHTML={{ __html: DEFS }} /></svg>

      <svg viewBox="0 0 84 92" className={styles.item} data-slot="cylinder">
        <Metal d="M6 16 C6 4 78 4 78 16 V76 C78 88 6 88 6 76 Z" stroke={DATA} />
        <path d="M6 16 C6 28 78 28 78 16" fill="none" stroke={DATA} strokeOpacity={0.55} strokeWidth={1.3} />
        <g transform="translate(29 40)"><CustomNodeIcon name="arch-database" color={DATA} size={26} /></g>
      </svg>

      <svg viewBox="0 0 92 92" className={styles.item} data-slot="diamond">
        <Metal d="M46 4 L88 46 L46 88 L4 46 Z" stroke="#f5a524" />
        <text x="46" y="58" textAnchor="middle" className={styles.question}>?</text>
      </svg>

      <div className={styles.item} data-slot="mermaid">
        <span className={styles.mmTitle}>diagram.mmd</span>
        <code>
          <span><b>graph</b> LR</span>
          <span>  you --&gt;|one command| map</span>
          <span>  map -.-&gt; agents</span>
        </code>
      </div>

      <svg viewBox="0 0 104 92" className={styles.item} data-slot="hexagon">
        <Metal d="M28 6 H76 L100 46 L76 86 H28 L4 46 Z" stroke={COMPUTE} />
        <g transform="translate(37 31)"><CustomNodeIcon name="arch-api-gateway" color={COMPUTE} size={30} /></g>
      </svg>
    </div>
  );
}
