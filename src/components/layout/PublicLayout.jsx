import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import PublicHeader from './PublicHeader.jsx'
import Footer from './Footer.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function PublicLayout() {
  return (
    <div className="min-h-screen bg-page">
      <ScrollToTop />
      <PublicHeader />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default PublicLayout
