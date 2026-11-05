import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});

// Claude Code: a terminal coding agent. The CLI runs an agent loop that builds
// context (CLAUDE.md memory, skills), streams turns to the Anthropic API, and
// dispatches the model's tool calls through permission checks and hooks.
export const claudeCodeNodes: Node[] = [
  n('cc_dev','Developer','Terminal / IDE','client','#64748b','User',0,240),
  n('cc_cli','Claude Code CLI','REPL / headless -p','client','#64748b','Monitor',320,240),
  n('cc_loop','Agent Loop','Plan → act → observe','compute','#0d9488','Cpu',640,240),
  n('cc_context','Context Builder','System prompt + history','compute','#0d9488','Layers',960,80),
  n('cc_memory','CLAUDE.md Memory','Project / user','data','#334155','FileText',640,0),
  n('cc_skills','Skills & Plugins','SKILL.md bundles','data','#334155','Package',640,120),
  n('cc_compact','Compaction','Summarize long context','compute','#0d9488','ScrollText',960,0),
  n('cc_api','Anthropic API','Claude models','external','#0f766e','Brain',1280,80),
  n('cc_tools','Tool Router','tool_use dispatch','compute','#0d9488','Network',960,360),
  n('cc_perms','Permissions','settings.json / modes','auth','#64748b','Shield',1280,240),
  n('cc_hooks','Hooks','Pre / PostToolUse','async','#b45309','Webhook',1280,320),
  n('cc_files','File Tools','Read / Edit / Write','compute','#0d9488','Edit',1280,400),
  n('cc_bash','Bash','Shell commands','compute','#0d9488','Boxes',1280,480),
  n('cc_search','Search Tools','Grep / Glob','compute','#0d9488','Search',1280,560),
  n('cc_web','Web Tools','WebFetch / WebSearch','external','#0f766e','Globe',1280,640),
  n('cc_subagent','Subagents','Agent tool','compute','#0d9488','Users',1280,720),
  n('cc_mcp','MCP Servers','External tools','external','#0f766e','Webhook',1280,800),
  n('cc_repo','Workspace','Local repo / git','data','#334155','GitBranch',1600,480),
];

export const claudeCodeEdges: Edge[] = [
  e('cc_e1','cc_dev','cc_cli','prompt'),
  e('cc_e2','cc_cli','cc_loop','user turn'),
  e('cc_e3','cc_loop','cc_context','build request'),
  e('cc_e4','cc_memory','cc_context','instructions'),
  e('cc_e5','cc_skills','cc_context','skill content'),
  e('cc_e6','cc_compact','cc_context','summary'),
  e('cc_e7','cc_context','cc_api','messages + tools'),
  e('cc_e8','cc_api','cc_loop','streamed tokens','stream'),
  e('cc_e9','cc_loop','cc_compact','near context limit','async'),
  e('cc_e10','cc_loop','cc_tools','tool calls'),
  e('cc_e11','cc_tools','cc_perms','permission check'),
  e('cc_e12','cc_tools','cc_hooks','tool events','event'),
  e('cc_e13','cc_tools','cc_files','read / edit'),
  e('cc_e14','cc_tools','cc_bash','run'),
  e('cc_e15','cc_tools','cc_search','search'),
  e('cc_e16','cc_tools','cc_web','fetch','dep'),
  e('cc_e17','cc_tools','cc_subagent','delegate'),
  e('cc_e18','cc_tools','cc_mcp','MCP call','dep'),
  e('cc_e19','cc_files','cc_repo','files'),
  e('cc_e20','cc_bash','cc_repo','commands'),
  e('cc_e21','cc_search','cc_repo','matches'),
];
