import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore';

// 메인메뉴
const mainMenu = [
    {
        id: 1,
        menu: "영화",
        path: "/movie"
    },
    {
        id: 2,
        menu: "시리즈",
        path: "/series"
    },
    {
        id: 3,
        menu: "NEW",
        path: "/new"
    },
    {
        id: 4,
        menu: "애니메이션",
        path: "/animation"
    },
    {
        id: 5,
        menu: "찜 리스트",
        path: "/heart"
    },
    {
        id: 6,
        menu: "스포츠",
        path: "/sports"
    }
]

const familys = ["아빠", "엄마", "딸", "아들"];
export const Header = () => {
    // 경로
    const location = useLocation();
    const navigate = useNavigate();
    const { user, currentMember, onSetMember, onLogout } = useAuthStore();
    // 서브메뉴를 보여줄 것을 체크하는 변수
    const [showProfile, setShowProfile] = useState(false);
    // 서브메뉴를 보여줄 메서드
    // 사용자 변경 시 멤버 변경 메서드

    const handleChangeMember = (mem) => {
        onSetMember(mem);
        setShowProfile(false);
    }
    // 로그아웃
    const handleLogout = () => {
        onLogout();
        navigate("/");
    }


    const isHome = location.pathname === "/";

    return (
        <header className={`fixed w-full py-5 z-1000 ${isHome ? "bg-transparent" : "bg-green-100"}`}>
            <div className="inner flex flex-wrap gap-4 px-4 justify-between items-center">
                <div className="header-left flex flex-wrap gap-4 lg:gap-10 items-center">
                    <h1 className="logo"><Link to="/"><img src="/logo.png" alt="" className='w-40 ' /></Link></h1>
                    <ul className='flex flex-wrap gap-3 lg:gap-5'>
                        {mainMenu.map((menu) => (
                            <li key={menu.id}>
                                <Link className={`${isHome ? "text-white" : "text-black"}`} to={menu.path}>{menu.menu}</Link>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className={`header-right ${isHome ? "text-white" : "text-black"}`}>
                    <ul className='flex gap-5'>
                        <li><button>검색</button></li>
                        {user ? (
                            <>
                                <li>
                                    <button onClick={() => setShowProfile(!showProfile)}>{currentMember || "프로필1"}</button>
                                    {showProfile && (
                                        <div className='absolute bg-blue-500 p-2 border text-black'>
                                            {/* <p>{user.displayName || user.email}</p> */}
                                            <ul>
                                                {familys.map((f) => (
                                                    <li><button onClick={() => handleChangeMember(f)}>{f}</button></li>
                                                ))}
                                            </ul>
                                            <button onClick={handleLogout}>로그아웃</button>
                                        </div>
                                    )}
                                </li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/login">로그인</Link></li>
                                <li><Link to="/join">회원가입</Link></li>
                            </>
                        )}
                    </ul>
                </div>
            </div >
        </header >
    )
}
