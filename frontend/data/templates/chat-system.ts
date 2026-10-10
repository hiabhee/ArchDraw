import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const chatSystemNodes: Node[] = [
  n('chat_client','Client','Web / Mobile','client','#64748b','MessageSquare',0,300),
  n('chat_ws','WebSocket GW','Connections','edge','#0f766e','RadioTower',320,300),
  n('chat_presence','Presence','Online status','compute','#0d9488','Users',640,120),
  n('chat_msg','Message Service','Send / recv','compute','#0d9488','MessagesSquare',640,300),
  n('chat_history','Message Store','Cassandra','data','#334155','Database',960,300),
  n('chat_push','Push Service','APNS / FCM','external','#b45309','Bell',960,120),
  n('chat_search','Search','Elasticsearch','data','#334155','Search',960,480),
  n('chat_queue','Queue','Kafka','async','#b45309','Layers',640,480),
];
export const chatSystemEdges: Edge[] = [
  e('chat_e1','chat_client','chat_ws','WS connect','stream'),
  e('chat_e2','chat_ws','chat_presence','presence', 'event'),
  e('chat_e3','chat_ws','chat_msg','send message'),
  e('chat_e4','chat_msg','chat_history','persist'),
  e('chat_e5','chat_msg','chat_push','notify','async'),
  e('chat_e6','chat_msg','chat_queue','publish','event'),
  e('chat_e7','chat_queue','chat_search','index','event'),
];
