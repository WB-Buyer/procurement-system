export default function Layout({ profile, onLogout, navItems, activeNav, onNav, children }) {
  const roleLabel = { staff:'門市員工', manager:'門市店長', purchasing:'採購人員', admin:'超級管理員' }
  const roleColor = { staff:'#E0F5F5', manager:'#E6F1FB', purchasing:'#FEF3D7', admin:'#FEF3D7' }
  const roleText = { staff:'#085A5A', manager:'#0C447C', purchasing:'#633806', admin:'#633806' }

  const homeNav = {
    staff: 'catalog',
    manager: 'pending',
    purchasing: 'dashboard',
    admin: 'dashboard'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <div style={{ background:'#1A2F4A', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, flexShrink:0 }}>
        
        <div
          onClick={() => onNav(homeNav[profile?.role] || 'catalog')}
          style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        >
          <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <img
              src="/logo.png"
              alt="logo"
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => {
                e.target.style.display = 'none'
                e.target.parentNode.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>`
              }}
            />
          </div>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>晶緻集團請購系統</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ background: roleColor[profile?.role], color: roleText[profile?.role], fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20 }}>
            {roleLabel[profile?.role]}
          </span>
          <span style={{ color:'#B2C8D8', fontSize:13 }}>{profile?.full_name || profile?.store_name}</span>
          <button onClick={onLogout}
            style={{ background:'transparent', border:'1px solid #334D65', color:'#B2C8D8', padding:'4px 12px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
            登出
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ width:180, background:'#fff', borderRight:'1px solid #D8E4EC', padding:'12px 0', flexShrink:0, overflowY:'auto' }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => onNav(item.id)}
              style={{
                padding:'10px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                background: activeNav === item.id ? '#E0F5F5' : 'transparent',
                borderLeft: activeNav === item.id ? '3px solid #0D7E7E' : '3px solid transparent',
                color: activeNav === item.id ? '#085A5A' : '#6B7C8A',
                fontWeight: activeNav === item.id ? 500 : 400,
                fontSize: 13, transition:'all .15s'
              }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ marginLeft:'auto', background:'#0D7E7E', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10 }}>{item.badge}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:24, background:'#F5F8FA' }}>
          {children}
        </div>
      </div>
    </div>
  )
}