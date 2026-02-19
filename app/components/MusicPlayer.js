 'use client'
 import { useState, useEffect } from 'react'

 // Extract YouTube video ID from various URL formats
 function getYouTubeId(url) {
   const patterns = [
     /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
     /youtube\.com\/v\/([^&\n?#]+)/
   ]
   for (const pattern of patterns) {
     const match = url.match(pattern)
     if (match) return match[1]
   }
   return null
 }

 export default function MusicPlayer() {
   const [inputValue, setInputValue] = useState('')
   const [videoId, setVideoId] = useState(null)
   const [error, setError] = useState(null)
   const [minimized, setMinimized] = useState(false)
   const [mounted, setMounted] = useState(false)

   useEffect(() => {
     setMounted(true)
     const saved = localStorage.getItem('fah-music-url')
     if (saved) {
       setInputValue(saved)
       const id = getYouTubeId(saved)
       if (id) setVideoId(id)
     }
   }, [])

   function handleSubmit(e) {
     e.preventDefault()
     const trimmed = inputValue.trim()
     if (!trimmed) return
     
     const id = getYouTubeId(trimmed)
     if (!id) {
       setError('Invalid YouTube URL')
       return
     }
     
     setError(null)
     setVideoId(id)
     localStorage.setItem('fah-music-url', trimmed)    // notify game that music was loaded (for debugging)
    try {
      window.dispatchEvent(new CustomEvent('fah-music-loaded', { detail: { videoId: id } }))
    } catch (err) {
      // ignore
    }
    // (debug dispatch removed) music loaded
   }

   if (!mounted) return null

   return (
     <div className={`music-player ${minimized ? 'minimized' : ''}`}>
       {/* Toggle Button */}
       <button 
         className="music-player-toggle"
         onClick={() => setMinimized(prev => !prev)}
         title={minimized ? 'Expand player' : 'Minimize player'}
       >
         {minimized ? '🎵' : '−'}
       </button>

       {!minimized && (
         <div className="music-player-content">
           <div className="music-player-header">
             <span className="music-player-icon">🎵</span>
             <span className="music-player-title">Music</span>
           </div>

           <form onSubmit={handleSubmit} className="music-player-form">
             <input
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder="Paste YouTube URL..."
               className="music-player-input"
             />
             <button type="submit" className="music-player-load">
               Load
             </button>
           </form>

           {error && <div className="music-player-error">{error}</div>}

           {/* YouTube Player Embed */}
           <div className="music-player-video">
             {videoId ? (
              <iframe
                width="248"
                height="140"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&playlist=${videoId}`}
                title="YouTube music player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
             ) : (
               <div className="music-player-placeholder">
                 No track loaded
               </div>
             )}
           </div>
         </div>
       )}
     </div>
   )
 }
