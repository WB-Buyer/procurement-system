import { useState } from 'react'
import StaffApp from './StaffApp'
import ManagerApp from './ManagerApp'
import PurchasingApp from './PurchasingApp'

export default function AdminApp({ profile, onLogout }) {
  const [viewAs, setViewAs] = useState('purchasing')

  const mockProfile = (role) => ({
    ...profile,
    role,
    store_name: role === 'purchasing' ? '採購部' : '信義門市'
  })

  const views = {
    purchasing: <PurchasingApp profile={mockProfile('purchasing')} onLogout={onLogout} />,
    manager: <ManagerApp profile={mockProfile('manager')} onLogout={onLogout} />,
    staff: <StaffApp profile={mockProfile('staff')} onLogout={onLogout} />,
  }

  return (
    <div>
      <div style={{
        background: '#1A2F4A',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <span style={{ color: '#B2C