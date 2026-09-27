import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './owner/OwnerApp'
import './owner/owner.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
