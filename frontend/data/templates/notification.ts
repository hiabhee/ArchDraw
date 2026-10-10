import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const notificationNodes: Node[] = [
  n('nt_service','Service','Producer','compute','#0d9488','Cpu',0,200),
  n('nt_queue','Queue','Kafka / SQS','async','#b45309','MessagesSquare',320,200),
  n('nt_dispatcher','Dispatcher','Fanout','compute','#0d9488','GitBranch',640,200),
  n('nt_push','Push','FCM / APNS','external','#b45309','Smartphone',960,80),
  n('nt_email','Email','SES','external','#b45309','Mail',960,200),
  n('nt_sms','SMS','Twilio','external','#b45309','MessageSquare',960,320),
  n('nt_prefs','Preference DB','Opt-out','data','#334155','Database',640,400),
];
export const notificationEdges: Edge[] = [
  e('nt_e1','nt_service','nt_queue','enqueue','async'),
  e('nt_e2','nt_queue','nt_dispatcher','poll','event'),
  e('nt_e3','nt_dispatcher','nt_prefs','check prefs'),
  e('nt_e4','nt_dispatcher','nt_push','push','async'),
  e('nt_e5','nt_dispatcher','nt_email','email','async'),
  e('nt_e6','nt_dispatcher','nt_sms','sms','async'),
];
