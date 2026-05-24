import { useActions } from "../state/actions";

export default function ActionLog() {
  const list = useActions(s => s.list);
  const mark = useActions(s => s.mark);
  const remove = useActions(s => s.remove);
  const clear = useActions(s => s.clear);

  if (!list.length) return <div style={{color:"#9ca3af",fontSize:12}}>No actions queued.</div>;

  return (
    <div style={{fontSize:12}}>
      {list.map(a => (
        <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
          <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            <b>{a.title}</b> ---f---?s---,-- {a.next}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>mark(a.id, a.status==="done"?"queued":"done")}
              style={{background:"var(--chip)",color:"#e5e7eb",border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px"}}>
              {a.status==="done"?"Undo":"Done"}
            </button>
            <button onClick={()=>remove(a.id)}
              style={{background:"var(--chip)",color:"#e5e7eb",border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px"}}>
              Del
            </button>
          </div>
        </div>
      ))}
      <div style={{marginTop:8}}>
        <button onClick={clear}
          style={{background:"var(--chip)",color:"#e5e7eb",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px"}}>
          Clear All
        </button>
      </div>
    </div>
  );
}

