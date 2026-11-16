import{n as e}from"./rolldown-runtime-WkwZ5CU-.js";import{r as t,t as n}from"./core-7VJPxFFw.js";var r=new Map([[`avif`,`image/avif`],[`bmp`,`image/bmp`],[`css`,`text/css`],[`csv`,`text/csv`],[`doc`,`application/msword`],[`docx`,`application/vnd.openxmlformats-officedocument.wordprocessingml.document`],[`gif`,`image/gif`],[`gz`,`application/gzip`],[`htm`,`text/html`],[`html`,`text/html`],[`ico`,`image/x-icon`],[`jpeg`,`image/jpeg`],[`jpg`,`image/jpeg`],[`js`,`application/javascript`],[`json`,`application/json`],[`md`,`text/markdown`],[`mjs`,`application/javascript`],[`mp3`,`audio/mpeg`],[`mp4`,`video/mp4`],[`ogg`,`audio/ogg`],[`pdf`,`application/pdf`],[`png`,`image/png`],[`ppt`,`application/powerpoint`],[`pptx`,`application/vnd.openxmlformats-officedocument.presentationml.presentation`],[`svg`,`image/svg+xml`],[`tif`,`image/tiff`],[`tiff`,`image/tiff`],[`txt`,`text/plain`],[`wasm`,`application/wasm`],[`wav`,`audio/x-wav`],[`weba`,`audio/webm`],[`webm`,`video/webm`],[`webp`,`image/webp`],[`xls`,`application/vnd.ms-excel`],[`xlsx`,`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`],[`xml`,`application/xml`],[`zip`,`application/zip`]]),i=class extends Error{constructor(e){super(`DataTransferItem is not a file`),this.item=e,this.name=`UnexpectedObjectError`}};function a(e,t,n){let r=e,{webkitRelativePath:i}=e,a=typeof t==`string`?t:typeof i==`string`&&i.length>0?i:`./${e.name}`;return typeof r.path!=`string`&&s(r,`path`,a),n!==void 0&&Object.defineProperty(r,"handle",{value:n,writable:!1,configurable:!1,enumerable:!0}),s(r,`relativePath`,a),r}function o(e,t=r){let{name:n}=e;if(n&&n.lastIndexOf(`.`)!==-1&&!e.type){let r=n.split(`.`).pop().toLowerCase(),i=t.get(r);i&&Object.defineProperty(e,"type",{value:i,writable:!1,configurable:!1,enumerable:!0})}return e}function s(e,t,n){Object.defineProperty(e,t,{value:n,writable:!1,configurable:!1,enumerable:!0})}var c=[`.DS_Store`,`Thumbs.db`];async function l(e,{mimeTypes:t=r}={}){return(await u(e)).map(e=>e instanceof File?o(e,t):e)}async function u(e){return m(e)&&d(e.dataTransfer)?_(e.dataTransfer,e.type):f(e)?v(e.clipboardData):p(e)?h(e):Array.isArray(e)&&e.every(e=>`getFile`in e&&typeof e.getFile==`function`)?g(e):[]}function d(e){return m(e)}function f(e){return m(e)&&d(e.clipboardData)}function p(e){return m(e)&&m(e.target)}function m(e){return typeof e==`object`&&!!e}function h(e){return b(e.target.files).map(e=>a(e))}async function g(e){return(await Promise.all(e.map(e=>e.getFile()))).map(e=>a(e))}async function _(e,t){let n=b(e.items).filter(e=>e.kind===`file`);return t===`drop`?y(S(await Promise.all(n.map(x)))):n}function v(e){let t=b(e.items).filter(e=>e.kind===`file`).map(e=>e.getAsFile()).filter(e=>e!==null);return y((t.length>0?t:b(e.files)).map(e=>a(e)))}function y(e){return e.filter(e=>c.indexOf(e.name)===-1)}function b(e){return e===null?[]:Array.from(e)}async function x(e){if(typeof e.webkitGetAsEntry!=`function`)return C(e);let t=e.webkitGetAsEntry();if(t?.isDirectory){let n=await w(e);return n?.kind===`directory`?ee(n,`/${n.name}`):E(t)}return C(e,t)}function S(e){let t=[];for(let n of e)Array.isArray(n)?t.push(...S(n)):t.push(n);return t}async function C(e,t){let n=e.getAsFile(),r=await w(e);if(r!=null){let e=n??await r.getFile();return e.handle=r,a(e)}if(!n)throw new i(e);return a(n,t?.fullPath??void 0)}async function w(e){if(globalThis.isSecureContext&&typeof e.getAsFileSystemHandle==`function`)return e.getAsFileSystemHandle()}async function ee(e,t){let n=[];for await(let r of e.values()){let e=`${t}/${r.name}`;if(r.kind===`directory`)n.push(...await ee(r,e));else{let t=await r.getFile();n.push(a(t,e,r))}}return n}async function T(e){return e.isDirectory?E(e):D(e)}function E(e){let t=e.createReader();return new Promise((e,n)=>{let r=[];function i(){t.readEntries(async t=>{if(t.length){let e=Promise.all(t.map(T));r.push(e),i()}else try{e(await Promise.all(r))}catch(e){n(e)}},e=>{n(e)})}i()})}async function D(e){return new Promise((t,n)=>{e.file(n=>{t(a(n,e.fullPath))},e=>{n(e)})})}var O=e(t(),1);function k(e,t){if(e&&t){let n=(Array.isArray(t)?t:t.split(`,`)).filter(e=>e.trim()!==``);if(n.length===0)return!0;let r=e.name||``,i=(e.type||``).toLowerCase(),a=i.replace(/\/.*$/,``);return n.some(e=>{let t=e.trim().toLowerCase();return t.charAt(0)===`.`?r.toLowerCase().endsWith(t):t.endsWith(`/*`)?a===t.replace(/\/.*$/,``):i===t})}return!0}var A=n(),te=typeof k==`function`?k:k.default,j=`file-invalid-type`,M=`file-too-large`,N=`file-too-small`,P=`too-many-files`;function ne(e=``){let t=e.split(`,`);return{code:j,message:`File type must be ${t.length>1?`one of ${t.join(`, `)}`:t[0]}`}}var F=[`KB`,`MB`,`GB`,`TB`,`PB`];function re(e){if(e<1024)return`${e} ${e===1?`byte`:`bytes`}`;let t=e/1024,n=0;for(;t>=1024&&n<F.length-1;)t/=1024,n++;return`${Number(t.toFixed(2))} ${F[n]}`}function I(e){return{code:M,message:`File is larger than ${re(e)}`}}function L(e){return{code:N,message:`File is smaller than ${re(e)}`}}var ie={code:P,message:`Too many files`};function ae(e){return e.type===``&&typeof e.getAsFile==`function`}function oe(e,t){let n=e.type===`application/x-moz-file`||te(e,t??``)||ae(e);return[n,n?null:ne(t)]}function se(e,t,n){if(R(e.size)){if(R(t)&&R(n)){if(e.size>n)return[!1,I(n)];if(e.size<t)return[!1,L(t)]}else if(R(t)&&e.size<t)return[!1,L(t)];else if(R(n)&&e.size>n)return[!1,I(n)]}return[!0,null]}function R(e){return e!=null}function ce(e){return e!=null&&typeof e.then==`function`}function le({files:e,accept:t,minSize:n,maxSize:r,multiple:i,maxFiles:a=0,validator:o,getErrorMessage:s}){let c=[],l=[],u=(e,t)=>s&&typeof File<`u`&&t instanceof File?{...e,message:s(e,t)}:e;e.forEach(e=>{let[i,a]=oe(e,t),[o,s]=se(e,n,r);i&&o?c.push(e):l.push({file:e,errors:[a,s].filter(e=>e!=null).map(t=>u(t,e))})});let d=i?a>=1?a:1/0:1;return c.length>d&&c.slice(d).forEach(e=>{l.push({file:e,errors:[u(ie,e)]})}),l.length>0?{verdict:`reject`,rejections:l}:{verdict:o?`unknown`:`accept`,rejections:l}}function ue(e){return typeof e.isPropagationStopped==`function`?e.isPropagationStopped():e.cancelBubble!==void 0&&e.cancelBubble}function z(e){let t=e.dataTransfer??e.clipboardData;return t?Array.prototype.some.call(t.types,e=>e===`Files`||e===`application/x-moz-file`)||Array.prototype.some.call(t.items??[],B):!!e.target&&!!e.target.files}function B(e){return typeof e==`object`&&!!e&&e.kind===`file`}function de(e){e.preventDefault()}function fe(e){return e.indexOf(`MSIE`)!==-1||e.indexOf(`Trident/`)!==-1}function pe(e){return e.indexOf(`Edge/`)!==-1}function me(e=window.navigator.userAgent){return fe(e)||pe(e)}function V(...e){return(t,...n)=>e.some(e=>(!ue(t)&&e&&e(t,...n),ue(t)))}function he(){return`showOpenFilePicker`in window}function H(e){return Array.isArray(e)?e:typeof e==`string`?[e]:[]}function U(e){if(R(e))return Array.isArray(e)?e.filter(e=>R(e)&&R(e.accept)):[{accept:e}]}function ge(e){let t=[],n=Object.keys(e);for(let n of Object.values(e))for(let e of H(n))t.includes(e)||t.push(e);return t.length>0?t.join(`, `):n.length>0?n.join(`, `):`Files`}function _e(e){let t=U(e);if(!R(t))return;let n={};for(let e of t)for(let[t,r]of Object.entries(e.accept)){let e=n[t]??(n[t]=[]);for(let t of H(r))e.includes(t)||e.push(t)}return n}function ve(e){let t=U(e);if(!R(t))return;let n=t.map(e=>{let t=Object.entries(e.accept).filter(([e,t])=>{let n=!0;return W(e)||(console.warn(`Skipped "${e}" because it is not a valid MIME type. Check https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types for a list of valid MIME types.`),n=!1),(!(Array.isArray(t)||typeof t==`string`)||!H(t).every(we))&&(console.warn(`Skipped "${e}" because an invalid file extension was provided.`),n=!1),n}).reduce((e,[t,n])=>(e[t]=H(n),e),{});return{description:R(e.description)&&e.description!==``?e.description:ge(t),accept:t}}).filter(e=>Object.keys(e.accept).length>0);return n.length>0?n:void 0}function ye(e,{omitWildcardMimeTypesWithExtensions:t=!1}={}){if(R(e))return Object.entries(e).reduce((e,[n,r])=>{let i=H(r);return t&&Ce(n)&&i.some(we)?e.push(...i):e.push(n,...i),e},[]).filter(e=>W(e)||we(e)).join(`,`)}function be(e){return e instanceof DOMException&&(e.name===`AbortError`||e.code===e.ABORT_ERR)}function xe(e){return e instanceof DOMException&&(e.name===`SecurityError`||e.code===e.SECURITY_ERR)}function Se(e){return e instanceof DOMException&&e.name===`NotAllowedError`}function W(e){return e===`audio/*`||e===`video/*`||e===`image/*`||e===`text/*`||e===`application/*`||/\w+\/[-+.\w]+/g.test(e)}function Ce(e){return e.endsWith(`/*`)}function we(e){return/^.*\.[\w]+$/.test(e)}var Te=(0,O.forwardRef)(({children:e,...t},n)=>{let{open:r,...i}=G(t);return(0,O.useImperativeHandle)(n,()=>({open:r}),[r]),(0,A.jsx)(A.Fragment,{children:e?.({...i,open:r})})});Te.displayName=`Dropzone`;var Ee={isFocused:!1,isFileDialogActive:!1,isDragActive:!1,isDragAccept:!1,isDragReject:!1,isDragUnknown:!1,isDragGlobal:!1,isProcessing:!1,acceptedFiles:[],fileRejections:[],dragFileRejections:[]};function G(e={}){let{accept:t,disabled:n=!1,getFilesFromEvent:r=l,maxSize:i=1/0,minSize:a=0,multiple:o=!0,maxFiles:s=0,onDragEnter:c,onDragLeave:u,onDragOver:d,onDrop:f,onDropAccepted:p,onDropRejected:m,onFileDialogCancel:h,onFileDialogOpen:g,useFsAccessApi:_=!1,autoFocus:v=!1,preventDropOnDocument:y=!0,noClick:b=!1,noKeyboard:x=!1,noDrag:S=!1,noDragEventsBubbling:C=!1,noPaste:w=!1,onError:ee,validator:T,getErrorMessage:E}=e,D=(0,O.useMemo)(()=>_e(t),[t]),k=(0,O.useMemo)(()=>ye(D),[D]),A=(0,O.useMemo)(()=>ye(D,{omitWildcardMimeTypesWithExtensions:!0}),[D]),te=(0,O.useMemo)(()=>ve(t),[t]),j=(0,O.useMemo)(()=>typeof g==`function`?g:Oe,[g]),M=(0,O.useMemo)(()=>typeof h==`function`?h:Oe,[h]),N=(0,O.useRef)(null),P=(0,O.useRef)(null),[ne,F]=(0,O.useReducer)(De,Ee),{isFocused:re,isFileDialogActive:I}=ne,L=(0,O.useRef)(I);L.current=I;let ae=(0,O.useRef)(null),R=(0,O.useCallback)(()=>{ae.current?.abort();let e=new AbortController;return ae.current=e,F({type:`setProcessing`,isProcessing:!0}),e.signal},[]),B=(0,O.useCallback)(e=>{e.aborted||F({type:`setProcessing`,isProcessing:!1})},[]);(0,O.useEffect)(()=>()=>ae.current?.abort(),[]);let fe=(0,O.useRef)(typeof window<`u`&&window.isSecureContext&&_&&he()),pe=()=>{!fe.current&&I&&setTimeout(()=>{if(P.current){let{files:e}=P.current;e?.length||(F({type:`closeDialog`}),M())}},300)};(0,O.useEffect)(()=>(window.addEventListener(`focus`,pe,!1),()=>{window.removeEventListener(`focus`,pe,!1)}),[P,I,M,fe]);let H=(0,O.useRef)([]),U=(0,O.useRef)([]),ge=e=>{N.current&&e.target&&N.current.contains(e.target)&&e.defaultPrevented||(e.preventDefault(),H.current=[])};(0,O.useEffect)(()=>(y&&(document.addEventListener(`dragover`,de,!1),document.addEventListener(`drop`,ge,!1)),()=>{y&&(document.removeEventListener(`dragover`,de),document.removeEventListener(`drop`,ge))}),[N,y]),(0,O.useEffect)(()=>{let e=e=>{e.target&&(U.current=[...U.current,e.target]),z(e)&&F({isDragGlobal:!0,type:`setDragGlobal`})},t=e=>{U.current=U.current.filter(t=>t!==e.target&&t!==null),!(U.current.length>0)&&F({isDragGlobal:!1,type:`setDragGlobal`})},n=()=>{U.current=[],F({isDragGlobal:!1,type:`setDragGlobal`})},r=()=>{U.current=[],F({isDragGlobal:!1,type:`setDragGlobal`})};return document.addEventListener(`dragenter`,e,!1),document.addEventListener(`dragleave`,t,!1),document.addEventListener(`dragend`,n,!1),document.addEventListener(`drop`,r,!1),()=>{document.removeEventListener(`dragenter`,e),document.removeEventListener(`dragleave`,t),document.removeEventListener(`dragend`,n),document.removeEventListener(`drop`,r)}},[N]),(0,O.useEffect)(()=>(!n&&v&&N.current&&N.current.focus(),()=>{}),[N,v,n]);let W=(0,O.useCallback)(e=>{ee?ee(e):console.error(e)},[ee]),Ce=(0,O.useCallback)(e=>{e.preventDefault(),e.persist?.(),Z(e),!L.current&&(H.current=[...H.current,e.target],z(e)&&Promise.resolve(r(e)).then(t=>{if(ue(e)&&!C)return;let n=t.length>0?le({files:t,accept:k,minSize:a,maxSize:i,multiple:o,maxFiles:s,validator:T,getErrorMessage:E}):null;F({isDragAccept:n?.verdict===`accept`,isDragReject:n?.verdict===`reject`,isDragUnknown:n?.verdict===`unknown`,isDragActive:!0,dragFileRejections:n?.rejections??[],type:`setDraggedFiles`}),c&&c(e)}).catch(e=>W(e)))},[r,c,W,C,k,a,i,o,s,T,E]),we=(0,O.useCallback)(e=>{if(e.preventDefault(),e.persist?.(),Z(e),L.current)return!1;let t=z(e);if(t&&e.dataTransfer)try{e.dataTransfer.dropEffect=`copy`}catch{}return t&&d&&d(e),!1},[d,C]),Te=(0,O.useCallback)(e=>{e.preventDefault(),e.persist?.(),Z(e);let t=H.current.filter(e=>N.current?.contains(e)),n=t.indexOf(e.target);n!==-1&&t.splice(n,1),H.current=t,!(t.length>0)&&(F({type:`setDraggedFiles`,isDragActive:!1,isDragAccept:!1,isDragReject:!1,isDragUnknown:!1,dragFileRejections:[]}),z(e)&&u&&u(e))},[N,u,C]),G=(0,O.useCallback)(async(e,t,n)=>{let r=(e,t)=>E?{...e,message:E(e,t)}:e,c=e=>{let n=[],i=[];e.forEach(({file:e,accepted:t,acceptError:a,sizeMatch:o,sizeError:s,customErrors:c})=>{let l=!c||Array.isArray(c)&&c.length===0;if(t&&o&&l)n.push(e);else{let t=[a,s];c&&(t=t.concat(c)),i.push({file:e,errors:t.filter(e=>e!=null).map(t=>r(t,e))})}});let a=o?s>=1?s:1/0:1;n.length>a&&n.splice(a).forEach(e=>{i.push({file:e,errors:[r(ie,e)]})}),F({acceptedFiles:n,fileRejections:i,type:`setFiles`}),f&&f(n,i,t),i.length>0&&m&&m(i,t),n.length>0&&p&&p(n,t)},l=e.map(e=>{let[t,n]=oe(e,A),[r,o]=se(e,a,i);return{file:e,accepted:t,acceptError:n,sizeMatch:r,sizeError:o,customErrors:T?T(e):null}});if(!l.some(({customErrors:e})=>ce(e))){c(l);return}let u;try{u=await Promise.all(l.map(async({customErrors:e,...t})=>({...t,customErrors:await e})))}catch(e){n.aborted||(B(n),W(e));return}n.aborted||c(u)},[F,o,A,a,i,s,f,p,m,T,E,W,B]),ke=(0,O.useCallback)(e=>{if(e.preventDefault(),e.persist?.(),Z(e),H.current=[],!(L.current&&e.dataTransfer)&&(F({type:`reset`}),z(e))){let t=R();Promise.resolve(r(e)).then(n=>{if(!t.aborted){if(ue(e)&&!C)B(t);else return G(n,e,t)}}).catch(e=>{t.aborted||(B(t),W(e))})}},[r,G,W,C,R,B]),K=(0,O.useCallback)(e=>{if(!z(e))return;e.preventDefault(),e.persist?.(),Z(e);let t=R();Promise.resolve(r(e)).then(n=>{if(!t.aborted){if(ue(e)&&!C)B(t);else return G(n,e,t)}}).catch(e=>{t.aborted||(B(t),W(e))})},[r,G,W,C,R,B]),q=(0,O.useCallback)(()=>{if(fe.current){F({type:`openDialog`}),j();let e={multiple:o,types:te},t;window.showOpenFilePicker(e).then(e=>(t=R(),r(e))).then(e=>{if(F({type:`closeDialog`}),!t.aborted)return G(e,null,t)}).catch(e=>{t&&B(t),be(e)?(M(e),F({type:`closeDialog`})):xe(e)||Se(e)?(fe.current=!1,P.current?(P.current.value=``,P.current.click()):W(Error(`Cannot open the file picker because the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API is not supported and no <input> was provided.`))):W(e)})}else P.current&&(F({type:`openDialog`}),j(),P.current.value=``,P.current.click())},[F,j,M,_,G,W,te,o,R,B]),J=(0,O.useCallback)(e=>{N.current?.isEqualNode(e.target)&&(e.key===` `||e.key===`Enter`||e.keyCode===32||e.keyCode===13)&&(e.preventDefault(),q())},[N,q]),Y=(0,O.useCallback)(()=>{F({type:`focus`})},[]),Ae=(0,O.useCallback)(()=>{F({type:`blur`})},[]),je=(0,O.useCallback)(()=>{b||(me()?setTimeout(q,0):q())},[b,q]),X=e=>n?null:e,Me=e=>x?null:X(e),Ne=e=>S?null:X(e),Pe=e=>w?null:X(e),Z=e=>{C&&e.stopPropagation()},Fe=(0,O.useMemo)(()=>({refKey:e=`ref`,role:t,onKeyDown:r,onFocus:i,onBlur:a,onClick:o,onDragEnter:s,onDragOver:c,onDragLeave:l,onDrop:u,onPaste:d,...f}={})=>({onKeyDown:Me(V(r,J)),onFocus:Me(V(i,Y)),onBlur:Me(V(a,Ae)),onClick:X(V(o,je)),onDragEnter:Ne(V(s,Ce)),onDragOver:Ne(V(c,we)),onDragLeave:Ne(V(l,Te)),onDrop:Ne(V(u,ke)),onPaste:Pe(V(d,K)),role:typeof t==`string`&&t!==``?t:`presentation`,[e]:N,...!n&&!x?{tabIndex:0}:{},...n?{"aria-disabled":!0}:{},...f}),[N,J,Y,Ae,je,Ce,we,Te,ke,K,x,S,w,n]),Ie=(0,O.useCallback)(e=>{e.stopPropagation()},[]),Le=(0,O.useMemo)(()=>({refKey:e=`ref`,onChange:t,onClick:n,...r}={})=>({accept:A,multiple:o,type:`file`,"aria-label":`file upload`,style:{border:0,display:`block`,height:0,margin:0,maxWidth:0,opacity:0,overflow:`hidden`,padding:0,width:0},onChange:X(V(t,ke)),onClick:X(V(n,Ie)),tabIndex:-1,[e]:P,...r}),[P,t,o,ke,n]);return{...ne,isFocused:re&&!n,getRootProps:Fe,getInputProps:Le,rootRef:N,inputRef:P,open:X(q)}}function De(e,t){switch(t.type){case`focus`:return{...e,isFocused:!0};case`blur`:return{...e,isFocused:!1};case`openDialog`:return{...Ee,isFileDialogActive:!0};case`closeDialog`:return{...e,isFileDialogActive:!1};case`setDraggedFiles`:return{...e,isDragActive:t.isDragActive,isDragAccept:t.isDragAccept,isDragReject:t.isDragReject,isDragUnknown:t.isDragUnknown,dragFileRejections:t.dragFileRejections};case`setProcessing`:return{...e,isProcessing:t.isProcessing};case`setFiles`:return{...e,acceptedFiles:t.acceptedFiles,fileRejections:t.fileRejections,dragFileRejections:[],isProcessing:!1,isDragReject:!1,isDragUnknown:!1};case`setDragGlobal`:return{...e,isDragGlobal:t.isDragGlobal};case`reset`:return{...Ee};default:return e}}function Oe(){}function ke(e){var t,n,r=``;if(typeof e==`string`||typeof e==`number`)r+=e;else if(typeof e==`object`){if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=ke(e[t]))&&(r&&(r+=` `),r+=n)}else for(n in e)e[n]&&(r&&(r+=` `),r+=n)}return r}function K(){for(var e,t,n=0,r=``,i=arguments.length;n<i;n++)(e=arguments[n])&&(t=ke(e))&&(r&&(r+=` `),r+=t);return r}var q=e=>typeof e==`number`&&!isNaN(e),J=e=>typeof e==`string`,Y=e=>typeof e==`function`,Ae=e=>J(e)||q(e),je=e=>J(e)||Y(e)?e:null,X=(e,t)=>e===!1||q(e)&&e>0?e:t,Me=e=>(0,O.isValidElement)(e)||J(e)||Y(e)||q(e);function Ne(e,t,n=300){let{scrollHeight:r,style:i}=e;requestAnimationFrame(()=>{i.minHeight=`initial`,i.height=r+`px`,i.transition=`all ${n}ms`,requestAnimationFrame(()=>{i.height=`0`,i.padding=`0`,i.margin=`0`,setTimeout(t,n)})})}function Pe({enter:e,exit:t,appendPosition:n=!1,collapse:r=!0,collapseDuration:i=300}){return function({children:a,position:o,preventExitTransition:s,done:c,nodeRef:l,isIn:u,playToast:d}){let f=n?`${e}--${o}`:e,p=n?`${t}--${o}`:t,m=(0,O.useRef)(0);return(0,O.useLayoutEffect)(()=>{let e=l.current,t=f.split(` `),n=r=>{r.target===l.current&&(d(),e.removeEventListener(`animationend`,n),e.removeEventListener(`animationcancel`,n),m.current===0&&r.type!==`animationcancel`&&e.classList.remove(...t))};e.classList.add(...t),e.addEventListener(`animationend`,n),e.addEventListener(`animationcancel`,n)},[]),(0,O.useEffect)(()=>{let e=l.current,t=()=>{e.removeEventListener(`animationend`,t),r?Ne(e,c,i):c()};u||(s?t():(m.current=1,e.className+=` ${p}`,e.addEventListener(`animationend`,t)))},[u]),O.createElement(O.Fragment,null,a)}}function Z(e,t){return{content:Fe(e.content,e.props),containerId:e.props.containerId,id:e.props.toastId,theme:e.props.theme,type:e.props.type,data:e.props.data||{},isLoading:e.props.isLoading,icon:e.props.icon,reason:e.removalReason,status:t}}function Fe(e,t,n=!1){return(0,O.isValidElement)(e)&&!J(e.type)?(0,O.cloneElement)(e,{closeToast:t.closeToast,toastProps:t,data:t.data,isPaused:n}):Y(e)?e({closeToast:t.closeToast,toastProps:t,data:t.data,isPaused:n}):e}function Ie({closeToast:e,theme:t,ariaLabel:n=`close`}){return O.createElement(`button`,{className:`Toastify__close-button Toastify__close-button--${t}`,type:`button`,onClick:t=>{t.stopPropagation(),e(!0)},"aria-label":n},O.createElement(`svg`,{"aria-hidden":`true`,viewBox:`0 0 14 16`},O.createElement(`path`,{fillRule:`evenodd`,d:`M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z`})))}function Le({delay:e,isRunning:t,closeToast:n,type:r=`default`,hide:i,className:a,controlledProgress:o,progress:s,rtl:c,isIn:l,theme:u}){let d=i||o&&s===0,f={animationDuration:`${e}ms`,animationPlayState:t?`running`:`paused`};o&&(f.transform=`scaleX(${s})`);let p=K(`Toastify__progress-bar`,o?`Toastify__progress-bar--controlled`:`Toastify__progress-bar--animated`,`Toastify__progress-bar-theme--${u}`,`Toastify__progress-bar--${r}`,{"Toastify__progress-bar--rtl":c}),m=Y(a)?a({rtl:c,type:r,defaultClassName:p}):K(p,a),h={[o&&s>=1?`onTransitionEnd`:`onAnimationEnd`]:o&&s<1?null:()=>{l&&n()}};return O.createElement(`div`,{className:`Toastify__progress-bar--wrp`,"data-hidden":d},O.createElement(`div`,{className:`Toastify__progress-bar--bg Toastify__progress-bar-theme--${u} Toastify__progress-bar--${r}`}),O.createElement(`div`,{role:`progressbar`,"aria-hidden":d?`true`:`false`,"aria-label":`notification timer`,"aria-valuenow":o?Math.round(s*100):void 0,"aria-valuemin":0,"aria-valuemax":100,className:m,style:f,...h}))}var Re=1,ze=()=>`${Re++}`;function Be(e,t,n){let r=1,i=0,a=[],o=[],s=t,c=new Map,l=new Set,u=e=>(l.add(e),()=>l.delete(e)),d=()=>{o=Array.from(c.values()),l.forEach(e=>e())},f=({containerId:t,toastId:n,updateId:r})=>{let i=t?t!==e:e!==1,a=c.has(n)&&r==null;return i||a},p=(e,t)=>{c.forEach(n=>{var r;(t==null||t===n.props.toastId)&&((r=n.toggle)==null||r.call(n,e))})},m=e=>{var t,r;e.isActive&&((r=(t=e.props)?.onClose)==null||r.call(t,e.removalReason),e.isActive=!1,n(Z(e,`removed`)))},h=e=>{if(e==null)c.forEach(m);else{let t=c.get(e);t&&m(t)}d()},g=()=>{i-=a.length,a=[]},_=e=>{var t,r;let{toastId:i,updateId:a}=e.props,o=a==null;e.staleId&&c.delete(e.staleId),e.isActive=!0,c.set(i,e),d(),n(Z(e,o?`added`:`updated`)),o&&((r=(t=e.props).onOpen)==null||r.call(t))};return{id:e,props:s,observe:u,toggle:p,removeToast:h,toasts:c,clearQueue:g,buildToast:(e,t)=>{if(f(t))return;let{toastId:n,updateId:o,data:l,staleId:u,delay:p}=t,m=o==null;m&&i++;let g={...s,style:s.toastStyle,key:r++,...Object.fromEntries(Object.entries(t).filter(([e,t])=>t!=null)),toastId:n,updateId:o,data:l,isIn:!1,className:je(t.className||s.toastClassName),progressClassName:je(t.progressClassName||s.progressClassName),autoClose:!t.isLoading&&X(t.autoClose,s.autoClose),closeToast(e){let t=c.get(n);t&&(t.removalReason=e,h(n))},deleteToast(){if(c.get(n)!=null){if(c.delete(n),i--,i<0&&(i=0),a.length>0){_(a.shift());return}d()}}};g.closeButton=s.closeButton,t.closeButton===!1||Me(t.closeButton)?g.closeButton=t.closeButton:t.closeButton===!0&&(g.closeButton=!Me(s.closeButton)||s.closeButton);let v={content:e,props:g,staleId:u};s.limit&&s.limit>0&&i>s.limit&&m?a.push(v):q(p)?setTimeout(()=>{_(v)},p):_(v)},setProps(e){s=e},setToggle:(e,t)=>{let n=c.get(e);n&&(n.toggle=t)},isToastActive:e=>c.get(e)?.isActive,getSnapshot:()=>o}}var Q=new Map,Ve=[],He=new Set,Ue=e=>He.forEach(t=>t(e)),We=()=>Q.size>0;function Ge(){Ve.forEach(e=>Xe(e.content,e.options)),Ve=[]}var Ke=(e,{containerId:t})=>Q.get(t||1)?.toasts.get(e);function qe(e,t){var n;if(t)return!!((n=Q.get(t))!=null&&n.isToastActive(e));let r=!1;return Q.forEach(t=>{t.isToastActive(e)&&(r=!0)}),r}function Je(e){if(!We())Ve=Ve.filter(t=>e!=null&&t.options.toastId!==e);else if(e==null||Ae(e))Q.forEach(t=>{t.removeToast(e)});else if(e&&(`containerId`in e||`id`in e)){let t=Q.get(e.containerId);t?t.removeToast(e.id):Q.forEach(t=>{t.removeToast(e.id)})}}var Ye=(e={})=>{Q.forEach(t=>{t.props.limit&&(!e.containerId||t.id===e.containerId)&&t.clearQueue()})};function Xe(e,t){Me(e)&&(We()||Ve.push({content:e,options:t}),Q.forEach(n=>{n.buildToast(e,t)}))}function Ze(e){var t;(t=Q.get(e.containerId||1))==null||t.setToggle(e.id,e.fn)}function Qe(e,t){Q.forEach(n=>{(t==null||!(t!=null&&t.containerId)||t?.containerId===n.id)&&n.toggle(e,t?.id)})}function $e(e){let t=e.containerId||1;return{subscribe(n){let r=Be(t,e,Ue);Q.set(t,r);let i=r.observe(n);return Ge(),()=>{i(),Q.delete(t)}},setProps(e){var n;(n=Q.get(t))==null||n.setProps(e)},getSnapshot(){return Q.get(t)?.getSnapshot()}}}function et(e){return He.add(e),()=>{He.delete(e)}}function tt(e){return e&&(J(e.toastId)||q(e.toastId))?e.toastId:ze()}function nt(e,t){return Xe(e,t),t.toastId}function rt(e,t){return{...t,type:t&&t.type||e,toastId:tt(t)}}function it(e){return(t,n)=>nt(t,rt(e,n))}function $(e,t){return nt(e,rt(`default`,t))}$.loading=(e,t)=>nt(e,rt(`default`,{isLoading:!0,autoClose:!1,closeOnClick:!1,closeButton:!1,draggable:!1,...t}));function at(e,{pending:t,error:n,success:r},i){let a;t&&(a=J(t)?$.loading(t,i):$.loading(t.render,{...i,...t}));let o={isLoading:null,autoClose:null,closeOnClick:null,closeButton:null,draggable:null},s=(e,t,n)=>{if(t==null){$.dismiss(a);return}let r={type:e,...o,...i,data:n},s=J(t)?{render:t}:t;return a?$.update(a,{...r,...s}):$(s.render,{...r,...s}),n},c=Y(e)?e():e;return c.then(e=>s(`success`,r,e)).catch(e=>s(`error`,n,e)),c}$.promise=at,$.success=it(`success`),$.info=it(`info`),$.error=it(`error`),$.warning=it(`warning`),$.warn=$.warning,$.dark=(e,t)=>nt(e,rt(`default`,{theme:`dark`,...t}));function ot(e){Je(e)}$.dismiss=ot,$.clearWaitingQueue=Ye,$.isActive=qe,$.update=(e,t={})=>{let n=Ke(e,t);if(n){let{props:r,content:i}=n,a={delay:100,...r,...t,toastId:t.toastId||e,updateId:ze()};a.toastId!==e&&(a.staleId=e);let o=a.render||i;delete a.render,nt(o,a)}},$.done=e=>{$.update(e,{progress:1})},$.onChange=et,$.play=e=>Qe(!0,e),$.pause=e=>Qe(!1,e);function st(e){let{subscribe:t,getSnapshot:n,setProps:r}=(0,O.useRef)($e(e)).current;r(e);let i=(0,O.useSyncExternalStore)(t,n,n)?.slice();function a(t){if(!i)return[];let n=new Map;return e.newestOnTop&&i.reverse(),i.forEach(e=>{let{position:t}=e.props;n.has(t)||n.set(t,[]),n.get(t).push(e)}),Array.from(n,e=>t(e[0],e[1]))}return{getToastToRender:a,isToastActive:qe,count:i?.length}}function ct(e){let[t,n]=(0,O.useState)(!1),[r,i]=(0,O.useState)(!1),a=(0,O.useRef)(null),o=(0,O.useRef)({start:0,delta:0,removalDistance:0,canCloseOnClick:!0,canDrag:!1,didMove:!1}).current,{autoClose:s,pauseOnHover:c,closeToast:l,onClick:u,closeOnClick:d}=e;Ze({id:e.toastId,containerId:e.containerId,fn:n}),(0,O.useEffect)(()=>{if(e.pauseOnFocusLoss)return f(),()=>{p()}},[e.pauseOnFocusLoss]);function f(){document.hasFocus()||_(),window.addEventListener(`focus`,g),window.addEventListener(`blur`,_)}function p(){window.removeEventListener(`focus`,g),window.removeEventListener(`blur`,_)}function m(t){if(e.draggable===!0||e.draggable===t.pointerType){v();let n=a.current;o.canCloseOnClick=!0,o.canDrag=!0,n.style.transition=`none`,e.draggableDirection===`x`?(o.start=t.clientX,o.removalDistance=n.offsetWidth*(e.draggablePercent/100)):(o.start=t.clientY,o.removalDistance=n.offsetHeight*(e.draggablePercent===80?e.draggablePercent*1.5:e.draggablePercent)/100)}}function h(t){let{top:n,bottom:r,left:i,right:o}=a.current.getBoundingClientRect();t.pointerType===`mouse`&&e.pauseOnHover&&t.clientX>=i&&t.clientX<=o&&t.clientY>=n&&t.clientY<=r?_():g()}function g(){n(!0)}function _(){n(!1)}function v(){o.didMove=!1,document.addEventListener(`pointermove`,b),document.addEventListener(`pointerup`,x)}function y(){document.removeEventListener(`pointermove`,b),document.removeEventListener(`pointerup`,x)}function b(n){let r=a.current;if(o.canDrag&&r){o.didMove=!0,t&&_(),e.draggableDirection===`x`?o.delta=n.clientX-o.start:o.delta=n.clientY-o.start,o.start!==n.clientX&&(o.canCloseOnClick=!1);let i=e.draggableDirection===`x`?`${o.delta}px, var(--y)`:`0, calc(${o.delta}px + var(--y))`;r.style.transform=`translate3d(${i},0)`,r.style.opacity=`${1-Math.abs(o.delta/o.removalDistance)}`}}function x(){y();let t=a.current;if(o.canDrag&&o.didMove&&t){if(o.canDrag=!1,Math.abs(o.delta)>o.removalDistance){i(!0),e.closeToast(!0),e.collapseAll();return}t.style.transition=`transform 0.2s, opacity 0.2s`,t.style.removeProperty(`transform`),t.style.removeProperty(`opacity`)}}let S={onPointerDown:m,onPointerUp:h};return s&&c&&(S.onMouseEnter=_,e.stacked||(S.onMouseLeave=g)),d&&(S.onClick=e=>{u&&u(e),o.canCloseOnClick&&l(!0)}),{playToast:g,pauseToast:_,isRunning:t,preventExitTransition:r,toastRef:a,eventHandlers:S}}var lt=typeof window<`u`?O.useLayoutEffect:O.useEffect,ut=({theme:e,type:t,isLoading:n,...r})=>O.createElement(`svg`,{viewBox:`0 0 24 24`,width:`100%`,height:`100%`,fill:e===`colored`?`currentColor`:`var(--toastify-icon-color-${t})`,...r});function dt(e){return O.createElement(ut,{...e},O.createElement(`path`,{d:`M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.251-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.84 8.06c-.057.581-.408.943-.897.943-.49 0-.84-.367-.896-.942l-.84-8.065c-.057-.624.25-1.095.779-1.095h1.91c.528.005.84.476.784 1.1z`}))}function ft(e){return O.createElement(ut,{...e},O.createElement(`path`,{d:`M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z`}))}function pt(e){return O.createElement(ut,{...e},O.createElement(`path`,{d:`M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z`}))}function mt(e){return O.createElement(ut,{...e},O.createElement(`path`,{d:`M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z`}))}function ht(){return O.createElement(`div`,{className:`Toastify__spinner`})}var gt={info:ft,warning:dt,success:pt,error:mt,spinner:ht},_t=e=>e in gt;function vt({theme:e,type:t,isLoading:n,icon:r}){let i=null,a={theme:e,type:t};return r===!1||(Y(r)?i=r({...a,isLoading:n}):(0,O.isValidElement)(r)?i=(0,O.cloneElement)(r,a):n?i=gt.spinner():_t(t)&&(i=gt[t](a))),i}var yt=e=>{let{isRunning:t,preventExitTransition:n,toastRef:r,eventHandlers:i,playToast:a}=ct(e),{closeButton:o,children:s,autoClose:c,onClick:l,type:u,hideProgressBar:d,closeToast:f,transition:p,position:m,className:h,style:g,progressClassName:_,updateId:v,role:y,progress:b,rtl:x,toastId:S,deleteToast:C,isIn:w,isLoading:ee,closeOnClick:T,theme:E,ariaLabel:D}=e,k=K(`Toastify__toast`,`Toastify__toast-theme--${E}`,`Toastify__toast--${u}`,{"Toastify__toast--rtl":x},{"Toastify__toast--close-on-click":T}),A=Y(h)?h({rtl:x,position:m,type:u,defaultClassName:k}):K(k,h),te=vt(e),j=!!b||!c,M={closeToast:f,type:u,theme:E},N=null;return o===!1||(N=Y(o)?o(M):(0,O.isValidElement)(o)?(0,O.cloneElement)(o,M):Ie(M)),O.createElement(p,{isIn:w,done:C,position:m,preventExitTransition:n,nodeRef:r,playToast:a},O.createElement(`div`,{id:S,tabIndex:0,onClick:l,"data-in":w,className:A,...i,style:g,ref:r,...w&&{role:y,"aria-label":D}},te!=null&&O.createElement(`div`,{className:K(`Toastify__toast-icon`,{"Toastify--animate-icon Toastify__zoom-enter":!ee})},te),Fe(s,e,!t),N,!e.customProgressBar&&O.createElement(Le,{...v&&!j?{key:`p-${v}`}:{},rtl:x,theme:E,delay:c,isRunning:t,isIn:w,closeToast:f,hide:d,type:u,className:_,controlledProgress:j,progress:b||0})))},bt=(e,t=!1)=>({enter:`Toastify--animate Toastify__${e}-enter`,exit:`Toastify--animate Toastify__${e}-exit`,appendPosition:t}),xt=Pe(bt(`bounce`,!0));Pe(bt(`slide`,!0)),Pe(bt(`zoom`)),Pe(bt(`flip`));var St={position:`top-right`,transition:xt,autoClose:5e3,closeButton:!0,pauseOnHover:!0,pauseOnFocusLoss:!0,draggable:`touch`,draggablePercent:80,draggableDirection:`x`,role:`alert`,theme:`light`,"aria-label":`Notifications Alt+T`,hotKeys:e=>e.altKey&&e.code===`KeyT`};function Ct(e){let t={...St,...e},n=e.stacked,[r,i]=(0,O.useState)(!0),a=(0,O.useRef)(null),{getToastToRender:o,isToastActive:s,count:c}=st(t),{className:l,style:u,rtl:d,containerId:f,hotKeys:p}=t;function m(e){let t=K(`Toastify__toast-container`,`Toastify__toast-container--${e}`,{"Toastify__toast-container--rtl":d});return Y(l)?l({position:e,rtl:d,defaultClassName:t}):K(t,je(l))}function h(){n&&(i(!0),$.play())}return lt(()=>{if(n){let e=a.current.querySelectorAll(`[data-in="true"]`),n=t.position?.includes(`top`),i=0,o=0;Array.from(e).reverse().forEach((e,t)=>{let a=e;a.classList.add(`Toastify__toast--stacked`),t>0&&(a.dataset.collapsed=`${r}`),a.dataset.pos||(a.dataset.pos=n?`top`:`bot`);let s=i*(r?.2:1)+(r?0:12*t),c=Math.max(.5,1-(r?o:0));a.style.setProperty(`--y`,`${n?s:s*-1}px`),a.style.setProperty(`--g`,`12`),a.style.setProperty(`--s`,`${c}`),i+=a.offsetHeight,o+=.025})}},[r,c,n]),(0,O.useEffect)(()=>{function e(e){var t;let n=a.current;p(e)&&((t=n?.querySelector(`[tabIndex="0"]`))==null||t.focus(),i(!1),$.pause()),e.key===`Escape`&&(document.activeElement===n||n!=null&&n.contains(document.activeElement))&&(i(!0),$.play())}return document.addEventListener(`keydown`,e),()=>{document.removeEventListener(`keydown`,e)}},[p]),O.createElement(`section`,{ref:a,className:`Toastify`,id:f,onMouseEnter:()=>{n&&(i(!1),$.pause())},onMouseLeave:h,"aria-live":`polite`,"aria-atomic":`false`,"aria-relevant":`additions text`,"aria-label":t[`aria-label`]},o((e,t)=>{let r=t.length?{...u}:{...u,pointerEvents:`none`};return O.createElement(`div`,{tabIndex:-1,className:m(e),"data-stacked":n,style:r,key:`c-${e}`},t.map(({content:e,props:t})=>O.createElement(yt,{...t,stacked:n,collapseAll:h,isIn:s(t.toastId,t.containerId),key:`t-${t.key}`},e)))}))}var wt=`:root {
  --toastify-color-light: #fff;
  --toastify-color-dark: #121212;
  --toastify-color-info: #3498db;
  --toastify-color-success: #07bc0c;
  --toastify-color-warning: #f1c40f;
  --toastify-color-error: hsl(6, 78%, 57%);
  --toastify-color-transparent: rgba(255, 255, 255, 0.7);

  --toastify-icon-color-info: var(--toastify-color-info);
  --toastify-icon-color-success: var(--toastify-color-success);
  --toastify-icon-color-warning: var(--toastify-color-warning);
  --toastify-icon-color-error: var(--toastify-color-error);

  --toastify-container-width: fit-content;
  --toastify-toast-width: 320px;
  --toastify-toast-offset: 16px;
  --toastify-toast-top: max(var(--toastify-toast-offset), env(safe-area-inset-top));
  --toastify-toast-right: max(var(--toastify-toast-offset), env(safe-area-inset-right));
  --toastify-toast-left: max(var(--toastify-toast-offset), env(safe-area-inset-left));
  --toastify-toast-bottom: max(var(--toastify-toast-offset), env(safe-area-inset-bottom));
  --toastify-toast-background: #fff;
  --toastify-toast-padding: 14px;
  --toastify-toast-min-height: 64px;
  --toastify-toast-max-height: 800px;
  --toastify-toast-bd-radius: 6px;
  --toastify-toast-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
  --toastify-font-family: sans-serif;
  --toastify-z-index: 9999;
  --toastify-text-color-light: #757575;
  --toastify-text-color-dark: #fff;

  /* Used only for colored theme */
  --toastify-text-color-info: #fff;
  --toastify-text-color-success: #fff;
  --toastify-text-color-warning: #fff;
  --toastify-text-color-error: #fff;

  --toastify-spinner-color: #616161;
  --toastify-spinner-color-empty-area: #e0e0e0;
  --toastify-color-progress-light: linear-gradient(to right, #4cd964, #5ac8fa, #007aff, #34aadc, #5856d6, #ff2d55);
  --toastify-color-progress-dark: #bb86fc;
  --toastify-color-progress-info: var(--toastify-color-info);
  --toastify-color-progress-success: var(--toastify-color-success);
  --toastify-color-progress-warning: var(--toastify-color-warning);
  --toastify-color-progress-error: var(--toastify-color-error);
  /* used to control the opacity of the progress trail */
  --toastify-color-progress-bgo: 0.2;
}

.Toastify__toast-container {
  z-index: var(--toastify-z-index);
  -webkit-transform: translate3d(0, 0, var(--toastify-z-index));
  position: fixed;
  width: var(--toastify-container-width);
  box-sizing: border-box;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.Toastify__toast-container--top-left {
  top: var(--toastify-toast-top);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--top-center {
  top: var(--toastify-toast-top);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--top-right {
  top: var(--toastify-toast-top);
  right: var(--toastify-toast-right);
  align-items: end;
}
.Toastify__toast-container--bottom-left {
  bottom: var(--toastify-toast-bottom);
  left: var(--toastify-toast-left);
}
.Toastify__toast-container--bottom-center {
  bottom: var(--toastify-toast-bottom);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}
.Toastify__toast-container--bottom-right {
  bottom: var(--toastify-toast-bottom);
  right: var(--toastify-toast-right);
  align-items: end;
}

.Toastify__toast {
  --y: 0px;
  position: relative;
  touch-action: none;
  width: var(--toastify-toast-width);
  min-height: var(--toastify-toast-min-height);
  box-sizing: border-box;
  margin-bottom: 1rem;
  padding: var(--toastify-toast-padding);
  border-radius: var(--toastify-toast-bd-radius);
  box-shadow: var(--toastify-toast-shadow);
  max-height: var(--toastify-toast-max-height);
  font-family: var(--toastify-font-family);
  /* webkit only issue #791 */
  z-index: 0;
  /* inner swag */
  display: flex;
  flex: 1 auto;
  align-items: center;
  word-break: break-word;
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container {
    width: 100vw;
    left: env(safe-area-inset-left);
    margin: 0;
  }
  .Toastify__toast-container--top-left,
  .Toastify__toast-container--top-center,
  .Toastify__toast-container--top-right {
    top: env(safe-area-inset-top);
    transform: translateX(0);
  }
  .Toastify__toast-container--bottom-left,
  .Toastify__toast-container--bottom-center,
  .Toastify__toast-container--bottom-right {
    bottom: env(safe-area-inset-bottom);
    transform: translateX(0);
  }
  .Toastify__toast-container--rtl {
    right: env(safe-area-inset-right);
    left: initial;
  }
  .Toastify__toast {
    --toastify-toast-width: 100%;
    margin-bottom: 0;
    border-radius: 0;
  }
}

.Toastify__toast-container[data-stacked='true'] {
  width: var(--toastify-toast-width);
}

@media only screen and (max-width: 480px) {
  .Toastify__toast-container[data-stacked='true'] {
    width: 100vw;
  }
}

.Toastify__toast--stacked {
  position: absolute;
  width: 100%;
  transform: translate3d(0, var(--y), 0) scale(var(--s));
  transition: transform 0.3s;
}

.Toastify__toast--stacked[data-collapsed] .Toastify__toast-body,
.Toastify__toast--stacked[data-collapsed] .Toastify__close-button {
  transition: opacity 0.1s;
}

.Toastify__toast--stacked[data-collapsed='false'] {
  overflow: visible;
}

.Toastify__toast--stacked[data-collapsed='true']:not(:last-child) > * {
  opacity: 0;
}

.Toastify__toast--stacked:after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: calc(var(--g) * 1px);
  bottom: 100%;
}

.Toastify__toast--stacked[data-pos='top'] {
  top: 0;
}

.Toastify__toast--stacked[data-pos='bot'] {
  bottom: 0;
}

.Toastify__toast--stacked[data-pos='bot'].Toastify__toast--stacked:before {
  transform-origin: top;
}

.Toastify__toast--stacked[data-pos='top'].Toastify__toast--stacked:before {
  transform-origin: bottom;
}

.Toastify__toast--stacked:before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  transform: scaleY(3);
  z-index: -1;
}

.Toastify__toast--rtl {
  direction: rtl;
}

.Toastify__toast--close-on-click {
  cursor: pointer;
}

.Toastify__toast-icon {
  margin-inline-end: 10px;
  width: 22px;
  flex-shrink: 0;
  display: flex;
}

.Toastify--animate {
  animation-fill-mode: both;
  animation-duration: 0.5s;
}

.Toastify--animate-icon {
  animation-fill-mode: both;
  animation-duration: 0.3s;
}

.Toastify__toast-theme--dark {
  background: var(--toastify-color-dark);
  color: var(--toastify-text-color-dark);
}

.Toastify__toast-theme--light {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--default {
  background: var(--toastify-color-light);
  color: var(--toastify-text-color-light);
}

.Toastify__toast-theme--colored.Toastify__toast--info {
  color: var(--toastify-text-color-info);
  background: var(--toastify-color-info);
}

.Toastify__toast-theme--colored.Toastify__toast--success {
  color: var(--toastify-text-color-success);
  background: var(--toastify-color-success);
}

.Toastify__toast-theme--colored.Toastify__toast--warning {
  color: var(--toastify-text-color-warning);
  background: var(--toastify-color-warning);
}

.Toastify__toast-theme--colored.Toastify__toast--error {
  color: var(--toastify-text-color-error);
  background: var(--toastify-color-error);
}

.Toastify__progress-bar-theme--light {
  background: var(--toastify-color-progress-light);
}

.Toastify__progress-bar-theme--dark {
  background: var(--toastify-color-progress-dark);
}

.Toastify__progress-bar--info {
  background: var(--toastify-color-progress-info);
}

.Toastify__progress-bar--success {
  background: var(--toastify-color-progress-success);
}

.Toastify__progress-bar--warning {
  background: var(--toastify-color-progress-warning);
}

.Toastify__progress-bar--error {
  background: var(--toastify-color-progress-error);
}

.Toastify__progress-bar-theme--colored.Toastify__progress-bar--info,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--success,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--warning,
.Toastify__progress-bar-theme--colored.Toastify__progress-bar--error {
  background: var(--toastify-color-transparent);
}

.Toastify__close-button {
  color: #fff;
  position: absolute;
  top: 6px;
  right: 6px;
  background: transparent;
  outline: none;
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
  transition: 0.3s ease;
  z-index: 1;
}

.Toastify__toast--rtl .Toastify__close-button {
  left: 6px;
  right: unset;
}

.Toastify__close-button--light {
  color: #000;
  opacity: 0.3;
}

.Toastify__close-button > svg {
  fill: currentColor;
  height: 16px;
  width: 14px;
}

.Toastify__close-button:hover,
.Toastify__close-button:focus {
  opacity: 1;
}

@keyframes Toastify__trackProgress {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

.Toastify__progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  opacity: 0.7;
  transform-origin: left;
}

.Toastify__progress-bar--animated {
  animation: Toastify__trackProgress linear 1 forwards;
}

.Toastify__progress-bar--controlled {
  transition: transform 0.2s;
}

.Toastify__progress-bar--rtl {
  right: 0;
  left: initial;
  transform-origin: right;
  border-bottom-left-radius: initial;
}

.Toastify__progress-bar--wrp {
  position: absolute;
  overflow: hidden;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  border-bottom-left-radius: var(--toastify-toast-bd-radius);
  border-bottom-right-radius: var(--toastify-toast-bd-radius);
}

.Toastify__progress-bar--wrp[data-hidden='true'] {
  opacity: 0;
}

.Toastify__progress-bar--bg {
  opacity: var(--toastify-color-progress-bgo);
  width: 100%;
  height: 100%;
}

.Toastify__spinner {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: var(--toastify-spinner-color-empty-area);
  border-right-color: var(--toastify-spinner-color);
  animation: Toastify__spin 0.65s linear infinite;
}

@keyframes Toastify__bounceInRight {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(-25px, 0, 0);
  }
  75% {
    transform: translate3d(10px, 0, 0);
  }
  90% {
    transform: translate3d(-5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutRight {
  20% {
    opacity: 1;
    transform: translate3d(-20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInLeft {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(-3000px, 0, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(25px, 0, 0);
  }
  75% {
    transform: translate3d(-10px, 0, 0);
  }
  90% {
    transform: translate3d(5px, 0, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutLeft {
  20% {
    opacity: 1;
    transform: translate3d(20px, var(--y), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(-2000px, var(--y), 0);
  }
}

@keyframes Toastify__bounceInUp {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  from {
    opacity: 0;
    transform: translate3d(0, 3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, -20px, 0);
  }
  75% {
    transform: translate3d(0, 10px, 0);
  }
  90% {
    transform: translate3d(0, -5px, 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes Toastify__bounceOutUp {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, -2000px, 0);
  }
}

@keyframes Toastify__bounceInDown {
  from,
  60%,
  75%,
  90%,
  to {
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  0% {
    opacity: 0;
    transform: translate3d(0, -3000px, 0);
  }
  60% {
    opacity: 1;
    transform: translate3d(0, 25px, 0);
  }
  75% {
    transform: translate3d(0, -10px, 0);
  }
  90% {
    transform: translate3d(0, 5px, 0);
  }
  to {
    transform: none;
  }
}

@keyframes Toastify__bounceOutDown {
  20% {
    transform: translate3d(0, calc(var(--y) - 10px), 0);
  }
  40%,
  45% {
    opacity: 1;
    transform: translate3d(0, calc(var(--y) + 20px), 0);
  }
  to {
    opacity: 0;
    transform: translate3d(0, 2000px, 0);
  }
}

.Toastify__bounce-enter--top-left,
.Toastify__bounce-enter--bottom-left {
  animation-name: Toastify__bounceInLeft;
}

.Toastify__bounce-enter--top-right,
.Toastify__bounce-enter--bottom-right {
  animation-name: Toastify__bounceInRight;
}

.Toastify__bounce-enter--top-center {
  animation-name: Toastify__bounceInDown;
}

.Toastify__bounce-enter--bottom-center {
  animation-name: Toastify__bounceInUp;
}

.Toastify__bounce-exit--top-left,
.Toastify__bounce-exit--bottom-left {
  animation-name: Toastify__bounceOutLeft;
}

.Toastify__bounce-exit--top-right,
.Toastify__bounce-exit--bottom-right {
  animation-name: Toastify__bounceOutRight;
}

.Toastify__bounce-exit--top-center {
  animation-name: Toastify__bounceOutUp;
}

.Toastify__bounce-exit--bottom-center {
  animation-name: Toastify__bounceOutDown;
}

@keyframes Toastify__zoomIn {
  from {
    opacity: 0;
    transform: scale3d(0.3, 0.3, 0.3);
  }
  50% {
    opacity: 1;
  }
}

@keyframes Toastify__zoomOut {
  from {
    opacity: 1;
  }
  50% {
    opacity: 0;
    transform: translate3d(0, var(--y), 0) scale3d(0.3, 0.3, 0.3);
  }
  to {
    opacity: 0;
  }
}

.Toastify__zoom-enter {
  animation-name: Toastify__zoomIn;
}

.Toastify__zoom-exit {
  animation-name: Toastify__zoomOut;
}

@keyframes Toastify__flipIn {
  from {
    transform: perspective(400px) rotate3d(1, 0, 0, 90deg);
    animation-timing-function: ease-in;
    opacity: 0;
  }
  40% {
    transform: perspective(400px) rotate3d(1, 0, 0, -20deg);
    animation-timing-function: ease-in;
  }
  60% {
    transform: perspective(400px) rotate3d(1, 0, 0, 10deg);
    opacity: 1;
  }
  80% {
    transform: perspective(400px) rotate3d(1, 0, 0, -5deg);
  }
  to {
    transform: perspective(400px);
  }
}

@keyframes Toastify__flipOut {
  from {
    transform: translate3d(0, var(--y), 0) perspective(400px);
  }
  30% {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, -20deg);
    opacity: 1;
  }
  to {
    transform: translate3d(0, var(--y), 0) perspective(400px) rotate3d(1, 0, 0, 90deg);
    opacity: 0;
  }
}

.Toastify__flip-enter {
  animation-name: Toastify__flipIn;
}

.Toastify__flip-exit {
  animation-name: Toastify__flipOut;
}

@keyframes Toastify__slideInRight {
  from {
    transform: translate3d(110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInLeft {
  from {
    transform: translate3d(-110%, 0, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInUp {
  from {
    transform: translate3d(0, 110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideInDown {
  from {
    transform: translate3d(0, -110%, 0);
    visibility: visible;
  }
  to {
    transform: translate3d(0, var(--y), 0);
  }
}

@keyframes Toastify__slideOutRight {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutLeft {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(-110%, var(--y), 0);
  }
}

@keyframes Toastify__slideOutDown {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, 500px, 0);
  }
}

@keyframes Toastify__slideOutUp {
  from {
    transform: translate3d(0, var(--y), 0);
  }
  to {
    visibility: hidden;
    transform: translate3d(0, -500px, 0);
  }
}

.Toastify__slide-enter--top-left,
.Toastify__slide-enter--bottom-left {
  animation-name: Toastify__slideInLeft;
}

.Toastify__slide-enter--top-right,
.Toastify__slide-enter--bottom-right {
  animation-name: Toastify__slideInRight;
}

.Toastify__slide-enter--top-center {
  animation-name: Toastify__slideInDown;
}

.Toastify__slide-enter--bottom-center {
  animation-name: Toastify__slideInUp;
}

.Toastify__slide-exit--top-left,
.Toastify__slide-exit--bottom-left {
  animation-name: Toastify__slideOutLeft;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-right,
.Toastify__slide-exit--bottom-right {
  animation-name: Toastify__slideOutRight;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--top-center {
  animation-name: Toastify__slideOutUp;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

.Toastify__slide-exit--bottom-center {
  animation-name: Toastify__slideOutDown;
  animation-timing-function: ease-in;
  animation-duration: 0.3s;
}

@keyframes Toastify__spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`,Tt=new Map,Et=(e,t)=>{lt(()=>{if(!e||typeof document>`u`)return;let n=document,r=Tt.get(n);if(r){t&&r.setAttribute(`nonce`,t);return}let i=n.createElement(`style`);i.textContent=e,t&&i.setAttribute(`nonce`,t),n.head.appendChild(i),Tt.set(n,i)},[t])};function Dt(e){return Et(wt,e.nonce),O.createElement(Ct,{...e})}export{G as i,Dt as n,$ as r,xt as t};