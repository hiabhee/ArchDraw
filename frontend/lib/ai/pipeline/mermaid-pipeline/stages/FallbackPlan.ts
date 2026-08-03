import { themePrimaryColor, themeToNodeTypeStyles, getDiagramTheme } from '@/lib/theme/stylingConstants';

export function generateFallbackPlan(prompt: string) {
  const mermaidCode = `graph TD
  subgraph CLIENT["Client Layer"]
    user["User"]
  end
  subgraph API["API Layer"]
    gateway["API Gateway"]
  end
  subgraph SERVICE["Service Layer"]
    service["Service"]
  end
  subgraph DATA["Data Layer"]
    database[("Database")]
  end
  user -->|request| gateway
  gateway -->|route| service
  service -->|query| database`;

  const theme = 'default';
  const pack = getDiagramTheme(theme);

  return {
    formatConfig: {
      format: 'mermaid' as const,
      diagramType: 'graph TD' as const,
      optionalVariants: [],
    },
    styleConfig: {
      primaryColor: themePrimaryColor(theme),
      secondaryColor: pack.concerns.data.color,
      background: pack.light.canvasHint,
      backgroundColor: pack.light.canvasHint,
      fontFamily: 'Inter',
      theme,
      nodeTypeStyles: themeToNodeTypeStyles(theme),
    },
    mermaidCode,
  };
}
