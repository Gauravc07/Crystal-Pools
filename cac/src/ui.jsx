// Small building blocks shared by the workspace screens (main.jsx, frp.jsx).
import React from 'react';
import { ChevronRight, Waves, X } from 'lucide-react';

export const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
export const date = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : 'Not scheduled';
export const dateTime = value => value ? new Date(value).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}) : 'Not scheduled';
export const nice = value => String(value || '').replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2');

export function Badge({children,tone}) { const word=String(children||'draft');return <span className={`badge ${tone || (['approved','verified','completed','Won'].includes(word)?'green':['pending','waiting_approval','needs_estimation'].includes(word)?'amber':['failed','rejected','Lost'].includes(word)?'red':'')}`}><span/>{nice(word)}</span>; }
export function Empty({title='A clear workspace, ready for your next step.',text='Add your first record to get started.',action}){return <div className="empty"><div className="empty-icon"><Waves size={28}/></div><h3>{title}</h3><p>{text}</p>{action}</div>;}
export function Button({children,onClick,primary=false,className='',...props}){return <button className={`button ${primary?'primary':''} ${className}`} onClick={onClick} {...props}>{children}</button>;}
export function Sheet({title,eyebrow='CRYSTAL POOLS WORKSPACE',close,large,children}){
  return <div className="overlay modal-overlay" onClick={close}><section className={`modal ${large?'large':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={21}/></button></div>{children}</section></div>;
}
export function DataTable({head,rows,render,onRow,empty}){
  return <div className="panel table-panel">{rows.length?<div className="table-scroll"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}{onRow&&<th/>}</tr></thead><tbody>{rows.map(row=><tr key={row.id} onClick={onRow?()=>onRow(row):undefined} className={onRow?'':'static-row'}>{render(row).map((cell,i)=><td key={i}>{cell}</td>)}{onRow&&<td><ChevronRight size={16}/></td>}</tr>)}</tbody></table></div>:<Empty title={empty[0]} text={empty[1]}/>}</div>;
}
export const cell=(main,sub)=><>{main}{sub?<small>{sub}</small>:null}</>;
