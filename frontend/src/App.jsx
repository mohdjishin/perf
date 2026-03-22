import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FeaturesProvider, useFeatures } from './context/FeaturesContext'
import { LoadingState } from './components/EmptyState'
import { PageSkeleton } from './components/Skeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const Shop = lazy(() => import('./pages/Shop'))
const Product = lazy(() => import('./pages/Product'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminCategories = lazy(() => import('./pages/admin/Categories'))
const AdminStock = lazy(() => import('./pages/admin/Stock'))
const AdminReviews = lazy(() => import('./pages/admin/Reviews'))
const AdminReturnRequests = lazy(() => import('./pages/admin/ReturnRequests'))
const SuperAdmin = lazy(() => import('./pages/superadmin/SuperAdmin'))
const SuperAdminAnalytics = lazy(() => import('./pages/superadmin/Analytics'))
const SuperAdminUsers = lazy(() => import('./pages/superadmin/Users'))
const SuperAdminFeatures = lazy(() => import('./pages/superadmin/Features'))
const SuperAdminOrderFee = lazy(() => import('./pages/superadmin/OrderFee'))
const SeasonalSale = lazy(() => import('./pages/superadmin/SeasonalSale'))
const Investigate = lazy(() => import('./pages/superadmin/Investigate'))
const Profile = lazy(() => import('./pages/Profile'))
const Orders = lazy(() => import('./pages/Orders'))
const ShopLocator = lazy(() => import('./pages/ShopLocator'))
const StoreLocations = lazy(() => import('./pages/superadmin/StoreLocations'))
const NotFound = lazy(() => import('./pages/NotFound'))

function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  // Wait for auth to finish loading before making any redirect decisions
  if (loading) return <LoadingState message="Checking auth..." />
  if (!token) return <Navigate to="/login" replace />
  // If roles are required but user hasn't resolved yet (e.g. token valid but profile still fetching)
  // keep showing loading rather than briefly mounting protected content or silently passing
  if (roles.length && !user) return <LoadingState message="Checking auth..." />
  if (roles.length && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function GoogleOAuthWrapper({ children }) {
  const { googleClientId } = useFeatures()
  return (
    <GoogleOAuthProvider clientId={googleClientId || ""}>
      {children}
    </GoogleOAuthProvider>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function ShortcutHandler() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        if (user?.role === 'super_admin') {
          navigate('/superadmin')
        } else if (user?.role === 'admin') {
          navigate('/admin')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [user, navigate])

  return null
}

function App() {
  return (
    <AuthProvider>
      <FeaturesProvider>
        <GoogleOAuthWrapper>
          <CartProvider>
            <ScrollToTop />
            <ShortcutHandler />
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="store-locator" element={<ShopLocator />} />
                  <Route path="product/:id" element={<Product />} />
                  <Route path="cart" element={
                    <ProtectedRoute><Cart /></ProtectedRoute>
                  } />
                  <Route path="checkout" element={
                    <ProtectedRoute><Checkout /></ProtectedRoute>
                  } />
                  <Route path="checkout/success" element={
                    <ProtectedRoute><CheckoutSuccess /></ProtectedRoute>
                  } />
                  <Route path="orders" element={
                    <ProtectedRoute>
                      <ErrorBoundary><Orders /></ErrorBoundary>
                    </ProtectedRoute>
                  } />
                  <Route path="profile" element={
                    <ProtectedRoute><Profile /></ProtectedRoute>
                  } />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="admin" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/products" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminProducts />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/orders" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminOrders />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/categories" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminCategories />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/stock" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminStock />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/reviews" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminReviews />
                    </ProtectedRoute>
                  } />
                  <Route path="admin/return-requests" element={
                    <ProtectedRoute roles={['admin', 'super_admin']}>
                      <AdminReturnRequests />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SuperAdmin />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/analytics" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SuperAdminAnalytics />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/features" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SuperAdminFeatures />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/order-fee" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SuperAdminOrderFee />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/seasonal-sale" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SeasonalSale />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/users" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <SuperAdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/investigate" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <Investigate />
                    </ProtectedRoute>
                  } />
                  <Route path="superadmin/store-locations" element={
                    <ProtectedRoute roles={['super_admin']}>
                      <StoreLocations />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </CartProvider>
        </GoogleOAuthWrapper>
      </FeaturesProvider>
    </AuthProvider>
  )
}

export default App
