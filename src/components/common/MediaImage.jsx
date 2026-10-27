import { cn } from '../../utils/cn.js'

const aspectClasses = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '3/2': 'aspect-[3/2]',
  none: '',
}

function MediaImage({
  src,
  alt = '',
  aspect = '16/9',
  rounded = true,
  className = '',
}) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-page',
        rounded && 'rounded-xl',
        aspect === 'none' ? 'h-full w-full' : aspectClasses[aspect] || aspectClasses['16/9'],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-soft">
          <span className="po-secondary">Image</span>
        </div>
      )}
    </div>
  )
}

export default MediaImage
