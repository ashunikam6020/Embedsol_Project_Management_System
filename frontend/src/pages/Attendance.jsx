import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { Alert, Empty, PageHead, fmtDate } from '../components';
import { useAuth } from '../auth';

export default function Attendance(){
  const { isAdmin } = useAuth();
  const [today,setToday]=useState(null); const [rows,setRows]=useState([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const load=()=>{ api.get('/attendance/today').then(r=>setToday(r.data.data)).catch(e=>setError(errMsg(e))); if(isAdmin) api.get('/attendance').then(r=>setRows(r.data.data)).catch(e=>setError(errMsg(e))); };
  useEffect(load,[isAdmin]);
  const act=async(path)=>{setBusy(true);setError('');try{await api.post(path);load()}catch(e){setError(errMsg(e))}finally{setBusy(false)}};
  return <>
    <PageHead title="Attendance" subtitle={isAdmin?'Team attendance and employee check-in history.':'Your daily check-in and check-out.'}/>
    <Alert>{error}</Alert>
    <section className="panel">
      <h3>Today</h3>
      <p className="muted">{today?.check_in?`Checked in at ${new Date(today.check_in).toLocaleTimeString('en-IN')}`:'Not checked in yet.'}</p>
      <div className="row-actions">
        <button className="btn primary" disabled={busy||!!today?.check_in} onClick={()=>act('/attendance/check-in')}>Check in</button>
        <button className="btn" disabled={busy||!today?.check_in||!!today?.check_out} onClick={()=>act('/attendance/check-out')}>Check out</button>
      </div>
    </section>
    {isAdmin && <section className="panel"><h3>Attendance history</h3>{rows.length===0?<Empty/>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>Check in</th><th>Check out</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{fmtDate(r.attendance_date)}</td><td>{r.full_name}</td><td>{r.status}</td><td>{r.check_in?new Date(r.check_in).toLocaleTimeString('en-IN'):'—'}</td><td>{r.check_out?new Date(r.check_out).toLocaleTimeString('en-IN'):'—'}</td></tr>)}</tbody></table></div>}</section>}
  </>;
}
