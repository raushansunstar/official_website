var x=Object.defineProperty,v=Object.defineProperties;var A=Object.getOwnPropertyDescriptors;var c=Object.getOwnPropertySymbols;var f=Object.prototype.hasOwnProperty,p=Object.prototype.propertyIsEnumerable;var w=(e,r,t)=>r in e?x(e,r,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[r]=t,i=(e,r)=>{for(var t in r||(r={}))f.call(r,t)&&w(e,t,r[t]);if(c)for(var t of c(r))p.call(r,t)&&w(e,t,r[t]);return e},g=(e,r)=>v(e,A(r));var u=(e,r)=>{var t={};for(var o in e)f.call(e,o)&&r.indexOf(o)<0&&(t[o]=e[o]);if(e!=null&&c)for(var o of c(e))r.indexOf(o)<0&&p.call(e,o)&&(t[o]=e[o]);return t};import{r as a}from"./index-BTISs8MR.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),h=(...e)=>e.filter((r,t,o)=>!!r&&r.trim()!==""&&o.indexOf(r)===t).join(" ").trim();/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var L={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=a.forwardRef((y,C)=>{var d=y,{color:e="currentColor",size:r=24,strokeWidth:t=2,absoluteStrokeWidth:o,className:l="",children:n,iconNode:m}=d,s=u(d,["color","size","strokeWidth","absoluteStrokeWidth","className","children","iconNode"]);return a.createElement("svg",i(g(i({ref:C},L),{width:r,height:r,stroke:e,strokeWidth:o?Number(t)*24/Number(r):t,className:h("lucide",l)}),s),[...m.map(([b,k])=>a.createElement(b,k)),...Array.isArray(n)?n:[n]])});/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=(e,r)=>{const t=a.forwardRef((m,n)=>{var s=m,{className:o}=s,l=u(s,["className"]);return a.createElement($,i({ref:n,iconNode:r,className:h(`lucide-${E(e)}`,o)},l))});return t.displayName=`${e}`,t};export{I as c};
