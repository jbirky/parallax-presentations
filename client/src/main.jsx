import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './index.css'
import 'katex/dist/katex.min.css'
// \ce and \pu (chemical equations and units) for every KaTeX the editor
// draws; decks load the same extension (generateHTML.js)
import 'katex/contrib/mhchem'
import { addLatinModernFaces } from './utils/latinModern'

// 'Latin Modern Roman', as decks draw it
addLatinModernFaces()

const isCloud = import.meta.env.VITE_PARALLAX_MODE === 'cloud'
const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function Root() {
  if (isCloud && clerkPk) {
    return (
      <ClerkProvider publishableKey={clerkPk}>
        <App />
      </ClerkProvider>
    )
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
