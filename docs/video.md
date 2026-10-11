# Video Element

Reference for the `VIDEO` element type: which files play, how to get a transparent
background, and how playback is kept in sync.

## Formats

| Format                         | Plays | Transparency | Notes                                                             |
| ------------------------------ | ----- | ------------ | ----------------------------------------------------------------- |
| **WebM (VP9 with alpha)**      | yes   | **yes**      | The format to use for a video with a transparent background.      |
| WebM (VP8 or VP9, no alpha)    | yes   | no           |                                                                   |
| MP4 (H.264)                    | yes   | no           | Has no alpha channel, so it always draws a solid background.      |
| GIF, animated WebP, APNG       | yes   | yes          | Drawn as images: they can only be shown or hidden, not paused.    |
| MOV (ProRes 4444), HEVC alpha  | no    | -            | Browsers, OBS's included, can't play these. Convert them first.   |

**Transparent videos must be WebM with VP9 and an alpha channel (`yuva420p`).** Uploads accept
MP4 and WebM only (checked by their first bytes, not the file name), up to
`MAX_VIDEO_UPLOAD_BYTES` (100 MB by default). A link may point to any video or image the browser
can load; links ending in `.gif`, `.webp`, `.png` and the like are drawn as images.

OBS's browser source is Chromium, which draws the alpha channel of VP9 WebM natively. Keep the
browser source's own background transparent (the default) and nothing else is needed.

### Converting to transparent WebM

From a ProRes 4444 `.mov`, a PNG sequence or any source that has an alpha channel:

```sh
ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 -an output.webm
```

* `-pix_fmt yuva420p` is what keeps the alpha channel. Without it the result is opaque.
* `-crf` sets the quality (lower is better and bigger); 30 is a good start for overlays.
* Drop `-an` to keep the sound.
* From a PNG sequence: `ffmpeg -framerate 30 -i frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 output.webm`.

To check a file has alpha:
`ffprobe -v error -select_streams v -show_entries stream_tags=alpha_mode output.webm` prints
`TAG:alpha_mode=1`. (`pix_fmt` reads `yuv420p` even then: WebM stores the alpha as a side channel.)

## Playback

The video plays like a tape. The `Video` model (`prisma/schema.prisma`) stores:

| Field       | Type       | Notes                                                              |
| ----------- | ---------- | ------------------------------------------------------------------ |
| `src`       | `String`   | An `/uploads/...` path or a link. Empty for none.                  |
| `position`  | `Float`    | Seconds into the video when it was last started, paused or reset.  |
| `startedAt` | `DateTime?`| When it started playing from `position`; `null` while paused.      |

While `startedAt` is set the video is at `position` plus the seconds since `startedAt`; otherwise
it is held at `position`. Controllers change it with actions (`play`, `pause`, `restart`,
`stop`), applied on the server with the server's clock (`lib/video.ts`, mirrored by
`src/lib/video.ts`). Only the browser knows the length of the file, so it wraps the time around
(`style.loop`, on by default) or stops on the last frame. `Video.tsx` seeks to the stored moment
whenever it changes and lets the video play on its own in between, so the editor, the controls
and OBS show the same frame.

## Style

`VideoStyle` (`src/lib/types.ts`): `width`, `height` (or fill), `borderRadius`, `objectFit`
(`cover` or `contain`), `loop`, `hideWhenStopped`, `muted` and `volume`. `muted`, `volume`,
`borderRadius` and `src` can be bound to variables (`src` to image variables).

## Sound

Sound plays only on the public page that OBS loads (`OverlayAudioContext`). The editor and the
previews stay silent so it isn't heard twice. A browser that blocks sound before the page was
clicked plays the video muted instead; OBS's browser source has no such limit.

## Serving

`/uploads/` answers HTTP Range requests (`206`, or `416` for a range outside the file), which
browsers need to seek in a video.
