import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import './app/theme.css'
import './utils/preloadAssets.js'
import Shell from './app/Shell.jsx'
import Upload from './routes/Upload.jsx'
import Scan from './routes/Scan.jsx'
import Lab from './routes/Lab.jsx'
import Results from './routes/Results.jsx'
import GestureLab from './routes/GestureLab.jsx'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Upload /> },
      { path: '/scan', element: <Scan /> },
      { path: '/lab', element: <Lab /> },
      { path: '/results', element: <Results /> },
      // Step 1's tuning rig. Kept on its own route because tuning the feel of
      // the detector needs the instruments, and the game screen must not have
      // sliders all over it.
      { path: '/dev/gestures', element: <GestureLab /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
