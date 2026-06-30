import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './HeroSlider.css';

const SLIDES = [
  {
    id: 1,
    image: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg',
    title: 'Lionel Messi',
    subtitle: 'Le Retour du GOAT. Pariez sur la magie avec des cotes premium.'
  },
  {
    id: 2,
    image: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/President_Donald_Trump_meets_with_Cristiano_Ronaldo_in_the_Oval_Office_%2854933344262%29_%28cropped_and_rotated%29.jpg',
    title: 'Cristiano Ronaldo',
    subtitle: 'Un Héritage Inégalé. Des cotes d\'élite pour un joueur d\'élite.'
  },
  {
    id: 3,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Neymar_Junior_Brazil_V_Morocco_13_June_2026-40.jpg/1280px-Neymar_Junior_Brazil_V_Morocco_13_June_2026-40.jpg',
    title: 'Neymar Jr',
    subtitle: 'Le Pur Talent. Maximisez vos gains sur nos marchés en direct.'
  },
  {
    id: 4,
    image: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Lamine_Yamal_a_Xina_%282025%29.png',
    title: 'Lamine Yamal',
    subtitle: 'L\'Avenir est là. Prenez de l\'avance dès aujourd\'hui.'
  },
  {
    id: 5,
    image: 'https://upload.wikimedia.org/wikipedia/commons/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg',
    title: 'Kylian Mbappé',
    subtitle: 'Vitesse Explosive. Faites exploser vos retours.'
  },
  {
    id: 6,
    image: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Harry_Kane_on_October_10%2C_2023.jpg',
    title: 'Harry Kane',
    subtitle: 'Finition Létale. Une valeur sûre et garantie.'
  },
  {
    id: 7,
    image: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Esteghlal_F.C._v_Al_Nassr_FC%2C_3_March_2025%2C_Sadio_Man%C3%A9.jpg',
    title: 'Sadio Mané',
    subtitle: 'La Fierté du Sénégal. Pariez sur la grandeur.'
  },
  {
    id: 8,
    image: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mohamed_Salah_2018.jpg',
    title: 'Mohamed Salah',
    subtitle: 'Le Roi Égyptien. Des gains royaux vous attendent.'
  },
  {
    id: 9,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Vin%C3%ADcius_J%C3%BAnior_Brazil_V_Morocco_13_June_2026-207_%28cropped%29.jpg/1280px-Vin%C3%ADcius_J%C3%BAnior_Brazil_V_Morocco_13_June_2026-207_%28cropped%29.jpg',
    title: 'Vinícius Júnior',
    subtitle: 'La Magie de la Samba. Des marchés toujours dynamiques.'
  }
];

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === SLIDES.length - 1 ? 0 : prev + 1));
    }, 3500); // Change slide every 3.5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-slider-container">
      <div 
        className="hero-static-bg" 
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80')` }} 
      />
      <div className="hero-static-overlay" />

      {SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
        >
          <div className="hero-slide-content">
            <h2 className="hero-slide-title">{slide.title}</h2>
            <p className="hero-slide-subtitle">{slide.subtitle}</p>
            <div className="hero-slide-cta">
              <Link to="/#sports" className="hero-cta-primary" onClick={() => {
                const el = document.getElementById('sports');
                if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
              }}>
                Voir les matchs
              </Link>
              <Link to="/auth?mode=register" className="hero-cta-secondary">
                S'inscrire gratuitement
              </Link>
            </div>
          </div>
          <div className="hero-slide-player-wrapper">
             <div 
               className="hero-slide-player-frame" 
               style={{ backgroundImage: `url(${slide.image})` }} 
             />
          </div>
        </div>
      ))}
      
      <div className="hero-slider-indicators">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            className={`hero-slider-dot ${index === currentSlide ? 'active' : ''}`}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
