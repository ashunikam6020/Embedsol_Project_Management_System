import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { Alert, Empty, PageHead } from '../components';
export default function Notifications(){
 const [rows,setRows]=useState([]); const [error,setError]=useState('');
 const load=()=>api.get('/notifications').then(r=>setRows(r.data.data)).catch(e=>setError(errMsg(e)));
 useEffect(load,[]);
 const read=async(id)=>{try{await api.patch(`/notifications/${id}/read`);load()}catch(e){setError(errMsg(e))}};
 const all=async()=>{try{await api.patch('/notifications/read-all');load()}catch(e){setError(errMsg(e))}};
 return <><PageHead title="Notifications" subtitle="Task, report and system updates."><button className="btn" onClick={all}>Mark all read</button></PageHead><Alert>{error}</Alert><section className="panel">{rows.length===0?<Empty>No notifications yet.</Empty>:rows.map(n=><div key={n.id} className="between" style={{padding:'14px 0',borderBottom:'1px solid #eee'}}><div><b>{n.title}</b><p className="muted small">{n.message}</p><small className="muted">{new Date(n.created_at).toLocaleString('en-IN')}</small></div>{!n.is_read&&<button className="btn" onClick={()=>read(n.id)}>Mark read</button>}</div>)}</section></>;
}
