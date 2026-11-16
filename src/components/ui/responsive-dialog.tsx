import * as React from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ResponsiveDialogContextValue {
  isMobile: boolean
}

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue>({
  isMobile: false,
})

export interface ResponsiveDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  modal?: boolean
  nested?: boolean
}

export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
  ...props
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange} {...props}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange} {...props}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  )
}

export function ResponsiveDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) {
    return <DrawerTrigger {...props} />
  }
  return <DialogTrigger {...props} />
}

export function ResponsiveDialogClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)
  if (isMobile) {
    return <DrawerClose {...props} />
  }
  return <DialogClose {...props} />
}

export interface ResponsiveDialogContentProps
  extends React.ComponentProps<typeof DialogContent> {
  showCloseButton?: boolean
  showHandle?: boolean
}

export function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = true,
  showHandle = true,
  ...props
}: ResponsiveDialogContentProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return (
      <DrawerContent
        showHandle={showHandle}
        className={cn('max-h-[92dvh] p-0 !overflow-hidden', className, '!overflow-hidden')}
        {...props}
      >
        <div
          data-vaul-no-drag
          className="sheet-stagger flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] touch-pan-y"
        >
          {children}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

export function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return (
      <DrawerHeader className={cn('px-0 pt-0 text-left', className)} {...props} />
    )
  }

  return <DialogHeader className={className} {...props} />
}

export function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return (
      <DrawerFooter
        className={cn(
          '-mx-5 -mb-4 mt-4 border-t bg-muted/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          className
        )}
        {...props}
      />
    )
  }

  return <DialogFooter className={className} {...props} />
}

export function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return <DrawerTitle className={className} {...props} />
  }

  return <DialogTitle className={className} {...props} />
}

export function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext)

  if (isMobile) {
    return <DrawerDescription className={className} {...props} />
  }

  return <DialogDescription className={className} {...props} />
}
