import { Route, Routes } from 'react-router-dom'
import './App.css'
import { Home } from './pages/Home'
import { Movie } from './pages/Movie'
import { Series } from './pages/Series'
import { New } from './pages/New'
import { Animation } from './pages/Animation'
import { Heart } from './pages/Heart'
import { Login } from './pages/Login'
import { Join } from './pages/Join'
import { Profile } from './pages/Profile'
import { MovieDetail } from './pages/MovieDetail'
import { TvDetail } from './pages/TvDetail'
import { SelectMember } from './pages/SelectMember'
import { Footer } from './components/Footer'
import { Header } from './components/Header'

function App() {

  return (
    <>
      <Header />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/movie' element={<Movie />} />
        <Route path='/series' element={<Series />} />
        <Route path='/new' element={<New />} />
        <Route path='/animation' element={<Animation />} />
        <Route path='/heart' element={<Heart />} />

        <Route path='/movieDetail/:id' element={<MovieDetail />} />
        <Route path='/tvDetail/:id' element={<TvDetail />} />

        <Route path='/login' element={<Login />} />
        <Route path='/selectMember' element={<SelectMember />} />
        <Route path='/profile' element={<Profile />} />
        <Route path='/join' element={<Join />} />
      </Routes>
      <Footer />
    </>
  )
}

export default App
