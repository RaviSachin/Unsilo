import type { LucideIcon } from "lucide-react";

export type TabKey = "overview" | "ask" | "sources" | "gmail" | "drive" | "whatsapp" | "outputs";
export interface Citation { source_id:string; type:string; title:string; from?:string|null; date?:string|null; url?:string|null; excerpt?:string }
export interface AskResponse { question:string; answerable:boolean; mode:string; answer:string; citations:Citation[]; retrieval?:{terms?:string[];period?:unknown;sources?:string[]} }
export interface Health {
  ok:boolean; ai:string; google_configured:boolean; google_connected:boolean; drive_mode:string;
  selected_groups:number; reference_date:string; setup:{source:string;text:string}[];
  counts:{emails:number;documents:number;whatsapp_messages:number};
}
export interface EmailRecord { message_id:string;thread_id:string;from:string;subject:string;date:string;classification?:string;classification_reason?:string;important_attachment?:boolean;attachment_flags?:{filename:string;kind:string}[] }
export interface GmailOutput { generated_at:string;reference_date:string;emails:EmailRecord[];unanswered:{message_id:string;days_without_reply:number}[];important_attachments:{message_id:string;subject:string;filename?:string;kind?:string}[] }
export interface DriveRecord {file_id:string;name:string;mime_type:string;url:string;category?:string;reason?:string;extraction_error?:string|null}
export interface DriveOutput {generated_at:string;documents:DriveRecord[]}
export interface WaMessage {message_id:string;sender_name?:string;sender?:string;sender_id?:string;sent_at?:string;timestamp?:string;text?:string;body?:string}
export interface WaGroup {group_id:string;name:string;participants:{name:string;wa_id:string}[];messages:WaMessage[];interpretation?:{method?:string;summary?:string;decisions?:string[];action_items?:string[]}}
export interface NavItem {id:TabKey;label:string;icon:LucideIcon}
export interface ApiError {detail?:string}
export const API = {
  health: "/api/health", ask: "/api/ask", groups: "/api/whatsapp/groups",
  gmail: "/api/outputs/gmail", drive: "/api/outputs/drive", whatsapp: "/api/outputs/whatsapp",
  analyse: "/api/analyse", export: "/api/export", syncGmail: "/api/sync/gmail", syncDrive: "/api/sync/drive",
  googleStart: "/api/oauth/google/start"
};
export async function request<T>(path:string, init:RequestInit = {}):Promise<T>{
  let response:Response;
  try { response=await fetch(path,{...init,headers:{"Content-Type":"application/json",...(init.headers||{})}}); }
  catch { throw new Error("Can't reach Unsilo API. Start FastAPI on localhost:8000."); }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error((payload as ApiError).detail || `Request failed (${response.status})`);
  return payload as T;
}
export const dateLabel=(value?:string|null)=>value?new Date(value).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";
export const emailBody=(a:AskResponse)=>`UNSILO — BUSINESS INTELLIGENCE\\n\\nQuestion: ${a.question}\\n\\nAnswer:\\n${a.answer}\\n\\nSupporting records:\\n${a.citations.map((c,i)=>`${i+1}. ${c.title} (${c.type})${c.date?` — ${dateLabel(c.date)}`:""}${c.url?`\\n   ${c.url}`:""}`).join("\\n")||"No citations returned."}\\n\\nPlease verify source records before acting.`;
