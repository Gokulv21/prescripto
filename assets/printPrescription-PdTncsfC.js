function m(p=".print-container"){let t=document.getElementById("print-mount");t||(t=document.createElement("div"),t.id="print-mount",t.style.cssText="position:fixed;top:0;left:0;width:100%;opacity:0;z-index:-99999;pointer-events:none;background:white;",document.body.insertBefore(t,document.body.firstChild)),t.innerHTML="";const i=document.querySelector(p);if(!i){console.error("[printPrescription] .print-container not found");return}const o=document.createElement("style");o.innerHTML=`
        @media print {
            #print-mount { 
                display: block !important; 
                visibility: visible !important; 
                opacity: 1 !important; 
                position: relative !important;
                z-index: 99999 !important;
            }
        }
    `,t.appendChild(o);const r=i.cloneNode(!0);r.id="prescription-to-print-cloned",t.appendChild(r),setTimeout(async()=>{const s=Array.from(t.querySelectorAll("img"));await Promise.all(s.map(n=>n.complete?Promise.resolve():new Promise(c=>{n.onload=c,n.onerror=c}))),await new Promise(n=>setTimeout(n,500)),window.print();const e=t;setTimeout(()=>{e&&e.innerHTML!==""&&(console.log("[printPrescription] Purging stale print content."),e.innerHTML="")},18e5)},300)}export{m as p};
