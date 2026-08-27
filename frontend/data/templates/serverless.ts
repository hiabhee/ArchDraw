import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const serverlessNodes: Node[] = [
  n('sls_client','Client','Web / Mobile','client','#64748b','Monitor',0,200),
  n('sls_cdn','CDN','CloudFront','client','#64748b','Globe',320,80),
  n('sls_gateway','API Gateway','HTTP','edge','#0f766e','Webhook',320,320),
  n('sls_lambda','Lambda','Function','compute','#0d9488','Zap',640,200),
  n('sls_dynamo','DynamoDB','NoSQL','data','#334155','Database',960,120),
  n('sls_s3','S3','Object storage','data','#334155','HardDrive',960,280),
  n('sls_eventbridge','EventBridge','Cron trigger','async','#b45309','Timer',640,400),
];
export const serverlessEdges: Edge[] = [
  e('sls_e1','sls_client','sls_cdn','static'),
  e('sls_e2','sls_client','sls_gateway','API call'),
  e('sls_e3','sls_gateway','sls_lambda','invoke'),
  e('sls_e4','sls_lambda','sls_dynamo','read/write'),
  e('sls_e5','sls_lambda','sls_s3','read/write'),
  e('sls_e6','sls_eventbridge','sls_lambda','cron', 'event'),
];
