# Layout toggler pipeline

Same path as the toolbar LR/TB layout toggler (`layoutDiagramViaMermaid` / `relayoutCanvasViaMermaid`).

Hand-authored or AI positions often overlap or ignore edge flow. Round-tripping through Mermaid + compound Dagre re-ranks nodes by edges, then SizeStage wraps groups around their children.

```mermaid
flowchart LR
  entry["Call sites:<br/>• Toolbar LayoutToggleButton<br/>• TemplateModal / ?template=<br/>• Editor AI generation<br/>• Store layered-lr / layered-tb"]
  RF_IN["React Flow<br/>nodes + edges"]
  TO_MM["reactFlowToMermaid<br/>graph LR|TD + subgraphs"]
  PARSE["Parse"]
  VALIDATE["Validate AST"]
  BUILD["Build RF objects"]
  LAYOUT["Dagre compound<br/>applyRfLayout"]
  SIZE["Size subgraphs<br/>parent bounds"]
  OUT_VAL["Validate output"]
  PRESERVE["Preserve types / data<br/>apply pipeline positions"]
  RF_OUT["React Flow<br/>laid out"]

  entry -.-> RF_IN
  RF_IN --> TO_MM --> PARSE --> VALIDATE --> BUILD --> LAYOUT --> SIZE --> OUT_VAL --> PRESERVE --> RF_OUT
```

See also: [layout-toggler-learnings.md](./layout-toggler-learnings.md).
