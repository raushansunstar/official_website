/* eslint-disable react/prop-types */
import { lazy, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { getToken } from './adminPanel/utils/auth';
import { PricingProvider } from './Context/PricingContext';
import { AdminProvider } from './adminPanel/utils/AdminContext';
import ScrollToTop from './ScrollToTop';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Lazy load ALL components for better initial load
const Layout = lazy(() => import(/* webpackChunkName: "layout" */ './Components/Layout'));
const Home = lazy(() => import(/* webpackChunkName: "home" */ './pages/Home/Home'));
const Sidebar = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/Components/Sidebar').then(m => ({ default: m.Sidebar })));
const SidebarItem = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/Components/Sidebar').then(m => ({ default: m.SidebarItem })));
const Header = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/Components/Header').then(m => ({ default: m.Header })));
const CookieConsent = lazy(() => import(/* webpackChunkName: "cookie" */ "./Components/CookieConsent"));

// Admin Pages
const Rooms = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/Rooms/Rooms').then(m => ({ default: m.Rooms })));
const AdminHotels = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/AdminHotels/AdminHotels').then(m => ({ default: m.AdminHotels })));
const AdminLogin = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const CreateUser = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/Users/CreateUser').then(m => ({ default: m.CreateUser })));
const ViewUser = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/Users/ViewUser'));
const AllUsers = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/Users/AllUsers'));
const HotelLocations = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/HotelLocations/HotelLocations').then(m => ({ default: m.HotelLocations })));
const EditHotel = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/AdminHotels/EditHotel'));
const AddHotel = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/AdminHotels/AddHotel'));
const UpdatePage = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/UpdatePages/UpdatePage'));
const DealsOffers = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/Deals&Offers/DealsOffers'));
const SeoMeta = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/OptimiseSeo/SeoMeta'));
const TourAndTravel = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/TourAndTravel/TourAndTravel'));
const Jobs = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/CareerPageJobs/Jobs'));
const BlogEditorTabs = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/ManageBlogs/BlogEditorTabs'));
const ManageDayUseRoom = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/ManageDayUseRoom/ManageDayUseRoom'));
const VenueManagement = lazy(() => import(/* webpackChunkName: "admin" */ './adminPanel/pages/VenueManagement/VenueManagement'));

// Public Pages
const AboutUs = lazy(() => import(/* webpackChunkName: "aboutus" */ './pages/About/AboutUs'));
const Corporatebooking = lazy(() => import(/* webpackChunkName: "corporatebooking" */ './pages/CorporateBooking/Corporatebooking'));
const Hotels = lazy(() => import(/* webpackChunkName: "hotels" */ './pages/Hotels/Hotels'));
const ContactUs = lazy(() => import(/* webpackChunkName: "contactus" */ './pages/ContactUs/ContactUs'));
const HotelRooms = lazy(() => import(/* webpackChunkName: "hotelrooms" */ './pages/Rooms/Rooms'));
const RoomsDetails = lazy(() => import(/* webpackChunkName: "roomsdetails" */ './pages/RoomDetailPricing/BookingDetailsPage'));
const CityPage = lazy(() => import(/* webpackChunkName: "citypage" */ './pages/Citypage/CityPage'));
const TermsAndConditions = lazy(() => import(/* webpackChunkName: "terms" */ './pages/OtherPages/TermsAndConditions'));
const CancellationPolicyPage = lazy(() => import(/* webpackChunkName: "privacy" */ './pages/OtherPages/PrivacyPolicies'));
const BlogsPage = lazy(() => import(/* webpackChunkName: "blogs" */ './pages/OtherPages/Blogs'));
const ReadBlogPage = lazy(() => import(/* webpackChunkName: "readblog" */ './pages/OtherPages/ReadBlog'));
const CorporateEventsPage = lazy(() => import(/* webpackChunkName: "events" */ './pages/OtherPages/CorporateEventsPage'));
const SocialEventsPage = lazy(() => import(/* webpackChunkName: "events" */ './pages/OtherPages/SocialEventsPage'));
const WeddingPreWeddingPage = lazy(() => import(/* webpackChunkName: "events" */ './pages/OtherPages/WeddingPreWeddingPage'));
const BookingForm = lazy(() => import(/* webpackChunkName: "booking" */ './pages/OtherPages/BookingForm'));
const DevelopersOwners = lazy(() => import(/* webpackChunkName: "developers" */ './pages/DevelopersAndOwners/DevelopersOwners'));
const DayUseRoom = lazy(() => import(/* webpackChunkName: "dayuse" */ './pages/DayUseRoom/DayUseRoom'));
const TourAndTravelPage = lazy(() => import(/* webpackChunkName: "travel" */ './pages/TourAndTravelPaage/TourAndTravelMain/TourAndTravelPage'));
const SelectedState = lazy(() => import(/* webpackChunkName: "travel" */ './pages/TourAndTravelPaage/SeletectedState/SelectedState'));
const PackageDetails = lazy(() => import(/* webpackChunkName: "travel" */ './pages/TourAndTravelPaage/PackageDetails/PackageDetail'));
const TravelBookingForm = lazy(() => import(/* webpackChunkName: "travel" */ './pages/TourAndTravelPaage/TravelBookingForm'));
const EventandConference = lazy(() => import(/* webpackChunkName: "events" */ './pages/OtherPages/EventandConference'));
const CareerMain = lazy(() => import(/* webpackChunkName: "career" */ './pages/SunstarCareer/CareerMain'));
const TravelAgent = lazy(() => import(/* webpackChunkName: "travelagent" */ './pages/TravelAgent/TravelAgent'));
const MyBookings = lazy(() => import(/* webpackChunkName: "mybookings" */ './pages/OtherPages/My-Bookings'));
const UserProfile = lazy(() => import(/* webpackChunkName: "profile" */ './pages/Profile/UserProfile'));
const IntheMediaMain = lazy(() => import(/* webpackChunkName: "media" */ './pages/InTheMedia/IntheMediaMain'));
const LoyaltyPrograme = lazy(() => import(/* webpackChunkName: "loyalty" */ './pages/LoyaltyPrograme/LoyaltyPrograme'));
const ThankYouPage = lazy(() => import(/* webpackChunkName: "thankyou" */ './pages/OtherPages/ThankYouPage'));
const NotFound = lazy(() => import(/* webpackChunkName: "notfound" */ './pages/OtherPages/NotFound'));

const queryClient = new QueryClient();



function PrivateRoute({ children }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/admin/login" />;
  }

  return (
    <div className="flex">
      <Suspense fallback={<div className="w-64 h-screen bg-white border-r animate-pulse" />}>
        <Sidebar>
          <SidebarItem />
        </Sidebar>
      </Suspense>
      <div className="flex-1">
        <Suspense fallback={<div className="h-16 bg-white border-b animate-pulse" />}>
          <Header />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <AdminProvider>
          <PricingProvider>
            <Routes>
              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/hotels" element={<PrivateRoute><AdminHotels /></PrivateRoute>} />
              <Route path="/admin/hotels/edit/:hotelCode" element={<PrivateRoute><EditHotel /></PrivateRoute>} />
              <Route path="/admin/hotels/add" element={<PrivateRoute><AddHotel /></PrivateRoute>} />
              <Route path="/admin/pages" element={<PrivateRoute><UpdatePage /></PrivateRoute>} />
              <Route path="/admin/offers" element={<PrivateRoute><DealsOffers /></PrivateRoute>} />
              <Route path="/admin/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
              <Route path="/admin/create_user" element={<PrivateRoute><CreateUser /></PrivateRoute>} />
              <Route path="/admin/view-user" element={<PrivateRoute><ViewUser /></PrivateRoute>} />
              <Route path="/admin/all-users" element={<PrivateRoute><AllUsers /></PrivateRoute>} />
              <Route path="/admin/hotel-locations" element={<PrivateRoute><HotelLocations /></PrivateRoute>} />
              {/* <Route path="/admin/manage-blogs" element={<PrivateRoute><ManageBlogs /></PrivateRoute>} /> */}
              <Route path="/admin/manage-blogs" element={<PrivateRoute><BlogEditorTabs /></PrivateRoute>} />
              <Route path="/admin/manage-seo" element={<PrivateRoute><SeoMeta /></PrivateRoute>} />
              <Route path="/admin/tour&travel" element={<PrivateRoute><TourAndTravel /></PrivateRoute>} />
              <Route path="/admin/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
              <Route path="/admin/day-use-room" element={<PrivateRoute><ManageDayUseRoom /></PrivateRoute>} />
              <Route path="/admin/venue-management" element={<PrivateRoute><VenueManagement /></PrivateRoute>} />

              {/* Main Website Routes */}
              <Route element={
                <Suspense>
                  <Layout />
                </Suspense>
              }>
                <Route path="/" element={
                  <Suspense>
                    <Home />
                  </Suspense>
                } />
                <Route path="/why-sunstar" element={<AboutUs />} />
                <Route path="/corporate-booking" element={<Corporatebooking />} />
                <Route path="/hotels/:hotelCode" element={
                  <Suspense>
                    <Hotels />
                  </Suspense>
                } />
                <Route path="/hotels/:hotelCode-:hotelName" element={
                  <Suspense>
                    <Hotels />
                  </Suspense>
                } />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/citypage/:cityName" element={<CityPage />} />
                <Route path="/terms-conditions&cancellation" element={<TermsAndConditions />} />
                <Route path="/privacy-policies" element={<CancellationPolicyPage />} />
                <Route path="/sunstar-blogs" element={<BlogsPage />} />
                <Route path="/sunstar-blogs/:slug" element={<ReadBlogPage />} />
                <Route path="/coorporatevents" element={<CorporateEventsPage />} />
                <Route path="/socialevents" element={<SocialEventsPage />} />
                <Route path="/weddingpreWedding" element={<WeddingPreWeddingPage />} />
                <Route path="/booking-form" element={<BookingForm />} />
                <Route path="/developers&owners" element={<DevelopersOwners />} />
                <Route path="/eventandconference" element={<EventandConference />} />
                <Route path="/dayuseroom" element={
                  <Suspense>
                    <DayUseRoom />
                  </Suspense>
                } />
                <Route path="/career" element={<CareerMain />} />
                <Route path="/tour&travel" element={<TourAndTravelPage />} />
                <Route path="/destination/:state" element={<SelectedState />} />
                <Route path="/package-detail/:title" element={<PackageDetails />} />
                <Route path="/travel-agent" element={<TravelAgent />} />
                <Route path="/in-the-media" element={<IntheMediaMain />} />
                <Route path="/loyalty-program" element={<LoyaltyPrograme />} />
                <Route path="/travel-booking-form" element={<TravelBookingForm />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/user/profile" element={<UserProfile />} />
                <Route path="/thankyou" element={<ThankYouPage />} />
              </Route>
              <Route path="/room/details" element={<RoomsDetails />} />
              <Route path="/room/:id" element={<HotelRooms />} />

              {/* 404 - Must be last */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PricingProvider>
        </AdminProvider>

      </Router>
      <Suspense fallback={null}>
        <CookieConsent />
      </Suspense>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
