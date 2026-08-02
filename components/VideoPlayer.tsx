"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { formatTime } from "@/lib/format";
import { DRIFT_TOLERANCE_SECONDS } from "@/lib/constants";
import {
  FullscreenExitIcon,
  FullscreenIcon,
  LoaderIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SubtitlesIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "./Icons";

export interface VideoPlayerHandle {
  /** Aligns the local player with an authoritative state coming from the server/Pusher. */
  syncTo: (opts: { position: number; isPlaying: boolean }) => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  /** Public URL to the subtitle file (WebVTT). Optional. */
  subtitleUrl?: string;
  onUserPlay: (position: number) => void;
  onUserPause: (position: number) => void;
  onUserSeek: (position: number) => void;
}

const SKIP_SECONDS = 10;

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  { src, poster, title, subtitleUrl, onUserPlay, onUserPause, onUserSeek },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(Boolean(subtitleUrl));

  useImperativeHandle(ref, () => ({
    syncTo({ position, isPlaying: shouldPlay }) {
      const video = videoRef.current;
      if (!video) return;

      if (Number.isFinite(position) && Math.abs(video.currentTime - position) > DRIFT_TOLERANCE_SECONDS) {
        video.currentTime = Math.max(position, 0);
        setCurrentTime(Math.max(position, 0));
      }

      if (shouldPlay && video.paused) {
        video.play().catch(() => {});
      } else if (!shouldPlay && !video.paused) {
        video.pause();
      }

      setJustSynced(true);
      window.setTimeout(() => setJustSynced(false), 900);
    },
    getCurrentTime() {
      return videoRef.current?.currentTime ?? 0;
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!isScrubbing) setCurrentTime(video.currentTime);
    };
    const onLoadedMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("progress", onProgress);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("progress", onProgress);
    };
  }, [isScrubbing]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
  }, [src]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Sync the visual subtitle state with the video's native track.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleUrl) return;
    const track = video.textTracks[0];
    if (track) track.mode = subtitlesOn ? "showing" : "hidden";
  }, [subtitlesOn, subtitleUrl, src]);

  useEffect(() => {
    setSubtitlesOn(Boolean(subtitleUrl));
  }, [subtitleUrl]);

  const toggleSubtitles = useCallback(() => {
    setSubtitlesOn((prev) => !prev);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      onUserPlay(video.currentTime);
    } else {
      video.pause();
      onUserPause(video.currentTime);
    }
  }, [onUserPlay, onUserPause]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.min(Math.max(time, 0), duration || video.duration || time);
      video.currentTime = clamped;
      setCurrentTime(clamped);
      onUserSeek(clamped);
    },
    [duration, onUserSeek]
  );

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      seekTo(video.currentTime + delta);
    },
    [seekTo]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const changeVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    };
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, skip, toggleMute, toggleFullscreen]);

  const displayedTime = isScrubbing ? scrubTime : currentTime;
  const progressPct = duration > 0 ? (displayedTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full"
        playsInline
        crossOrigin={subtitleUrl ? "anonymous" : undefined}
        onClick={togglePlay}
      >
        {subtitleUrl && (
          <track
            ref={trackRef}
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default={subtitlesOn}
          />
        )}
      </video>

      {isBuffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <LoaderIcon className="h-10 w-10 animate-spin text-white/90" />
        </div>
      )}

      {justSynced && (
        <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur">
          synced
        </div>
      )}

      {title && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 text-sm font-medium text-white/90">
          {title}
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-8 transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div className="group/bar relative mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/25">
          <div
            className="absolute h-full rounded-full bg-white/40"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute h-full rounded-full bg-red-500"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-red-500 opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={displayedTime}
            onChange={(e) => {
              setIsScrubbing(true);
              setScrubTime(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              setIsScrubbing(false);
              seekTo(Number((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              setIsScrubbing(false);
              seekTo(Number((e.target as HTMLInputElement).value));
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Video position"
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          <button
            onClick={togglePlay}
            className="rounded-full p-1.5 hover:bg-white/10 transition"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={() => skip(-SKIP_SECONDS)}
            className="rounded-full p-1.5 hover:bg-white/10 transition"
            aria-label={`Back ${SKIP_SECONDS}s`}
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>

          <button
            onClick={() => skip(SKIP_SECONDS)}
            className="rounded-full p-1.5 hover:bg-white/10 transition"
            aria-label={`Forward ${SKIP_SECONDS}s`}
          >
            <SkipForwardIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={toggleMute}
              className="rounded-full p-1.5 hover:bg-white/10 transition"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeMuteIcon className="h-5 w-5" /> : <VolumeIcon className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-red-500"
              aria-label="Volume"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/80">
            {formatTime(displayedTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {subtitleUrl && (
            <button
              onClick={toggleSubtitles}
              className={`rounded-full p-1.5 transition hover:bg-white/10 ${
                subtitlesOn ? "text-red-500" : "text-white"
              }`}
              aria-label={subtitlesOn ? "Turn off subtitles" : "Turn on subtitles"}
              aria-pressed={subtitlesOn}
            >
              <SubtitlesIcon className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="rounded-full p-1.5 hover:bg-white/10 transition"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <FullscreenExitIcon className="h-5 w-5" /> : <FullscreenIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
