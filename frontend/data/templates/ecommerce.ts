import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const ecommerceNodes: Node[] = [
  n('ec_client','Client','Web / Mobile','client','#64748b','Monitor',0,300),
  n('ec_cdn','CDN','Fastly','client','#64748b','Globe',320,100),
  n('ec_gateway','API Gateway','Kong','edge','#0f766e','Webhook',320,300),
  n('ec_auth','Auth Service','JWT','compute','#0d9488','Shield',640,80),
  n('ec_catalog','Catalog','Products','compute','#0d9488','Package',640,220),
  n('ec_cart','Cart','Redis','data','#334155','ShoppingCart',640,360),
  n('ec_order','Order Service','Orders','compute','#0d9488','Receipt',640,500),
  n('ec_payment','Payment','Stripe','external','#b45309','CreditCard',960,500),
  n('ec_search','Search','Elasticsearch','data','#334155','Search',960,220),
  n('ec_inventory','Inventory','Stock','data','#334155','Boxes',960,80),
];
export const ecommerceEdges: Edge[] = [
  e('ec_e1','ec_client','ec_cdn','assets'),
  e('ec_e2','ec_client','ec_gateway','HTTPS'),
  e('ec_e3','ec_gateway','ec_auth','auth'),
  e('ec_e4','ec_gateway','ec_catalog','list'),
  e('ec_e5','ec_gateway','ec_cart','cart ops'),
  e('ec_e6','ec_gateway','ec_order','checkout'),
  e('ec_e7','ec_catalog','ec_search','index','event'),
  e('ec_e8','ec_cart','ec_inventory','reserve'),
  e('ec_e9','ec_order','ec_payment','charge','dep'),
];
