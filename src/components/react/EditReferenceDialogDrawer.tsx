import React, { forwardRef } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "./Drawer"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./Dialog"
import { useMediaQuery } from '@react-hook/media-query'
import EditCitationForm from "./EditCitationForm"
import type { StoredSource } from '../../lib/references/storage';
import type { CSLItem } from '../../lib/citations/csl-types';
import { ScrollArea } from "./ScrollArea";
import { Line } from "./EditCitationFormComponents"
import { Pencil, RefreshCw } from "lucide-react"

type SetSources = (next: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;

interface EditReferenceDialogDrawerProps {
    source: StoredSource;
    setSources: SetSources;
}

// Hoisted out of the forwardRef body so its component identity is stable across
// renders of the parent — otherwise Radix would remount the Trigger and its
// click handler on every re-render of the surrounding row.
const TriggerButton = forwardRef<HTMLButtonElement, { onClick: () => void }>(({ onClick }, ref) => (
    <button
        ref={ref}
        className="flex gap-[5px] items-center text-[var(--color-text-light)] hover:text-[var(--color-text-primary)]"
        onClick={onClick}
    >
        <Pencil className="w-[20px] h-[20px]" />
        <span>Edit</span>
    </button>
));
TriggerButton.displayName = 'EditReferenceTriggerButton';

const Header = ({ isDesktop }: { isDesktop: boolean }) => {
    const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
    const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;
    return (
        <HeaderComponent className="m-0 p-5 px-8 shadow-sm border-b border-border border-b-solid">
            <TitleComponent>Edit Citation</TitleComponent>
        </HeaderComponent>
    );
};

const Content = ({
    source,
    setSources,
    isDesktop,
    currentRef,
}: {
    source: StoredSource;
    setSources: SetSources;
    isDesktop: boolean;
    currentRef: React.MutableRefObject<CSLItem | null>;
}) => {
    // On desktop the Dialog is centered and doesn't otherwise constrain its
    // own height, so the ScrollArea caps at 65vh. On mobile the Drawer is
    // already bounded (max-h-[97vh]) and is `flex flex-col`, so the ScrollArea
    // fills the remaining vertical space via `flex-1 min-h-0` — without that,
    // the long form scrolls off the bottom of the viewport unreachable.
    const sizing = isDesktop ? 'max-h-[65vh]' : 'min-h-0 flex-1';
    return (
        <ScrollArea className={`mx-auto w-full ${sizing} px-4 sm:px-8 pt-0 pb-0`}>
            {/* key forces a fresh form instance when the slot is reused with a
                different source (defense in depth — the parent <ReferenceItem
                key={uuid}> already isolates per source, but cheap insurance). */}
            <EditCitationForm key={source.uuid} source={source} setSources={setSources} currentRef={currentRef} />
            <Line className="my-8" />
            <div className="flex gap-2 items-center pb-8 text-muted-foreground ">
                <RefreshCw size={16} strokeWidth={1.8} />
                <p className="text-xs leading-none">All changes are saved automatically.</p>
            </div>
        </ScrollArea>
    );
};

const isEmptyCitation = (source: StoredSource): boolean => {
    const c = source.csl;
    const noAuthors = !c.author?.length;
    const noTitle = !c.title;
    const noContainer = !c['container-title'];
    const noUrl = !c.URL;
    const noYear = !c.issued?.['date-parts']?.[0]?.[0];
    return noAuthors && noTitle && noContainer && noUrl && noYear;
};

const EditReferenceDialogDrawer = forwardRef<HTMLButtonElement, EditReferenceDialogDrawerProps>(({ source, setSources }, ref) => {
    const [open, setOpen] = React.useState(false);
    const isDesktop = useMediaQuery("(min-width: 900px)");

    // EditCitationForm populates this on every keystroke. We read it on close
    // to decide empty-vs-flush before the form's 500ms debounce would fire,
    // otherwise a fast tap-outside drops the typed input (citation removed as
    // "still empty", or last keystroke lost when the unmount cleanup cancels
    // the pending timer).
    const currentRef = React.useRef<CSLItem | null>(null);

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            const current = currentRef.current ?? source.csl;
            if (isEmptyCitation({ ...source, csl: current })) {
                setSources((prev) => prev.filter((s) => s.uuid !== source.uuid));
            } else if (current !== source.csl) {
                // Flush the in-flight edit so the typed value isn't dropped
                // when the form unmounts (which clears the debounce timer).
                setSources((prev) => prev.map((s) => s.uuid === source.uuid ? { ...s, csl: current } : s));
            }
        }
        setOpen(newOpen);
    };

    const openDrawer = React.useCallback(() => setOpen(true), []);

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <TriggerButton ref={ref} onClick={openDrawer} />
                </DialogTrigger>
                <DialogContent className="p-0">
                    <Header isDesktop />
                    <Content source={source} setSources={setSources} isDesktop currentRef={currentRef} />
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerTrigger asChild>
                <TriggerButton ref={ref} onClick={openDrawer} />
            </DrawerTrigger>
            <DrawerContent>
                <Header isDesktop={false} />
                <Content source={source} setSources={setSources} isDesktop={false} currentRef={currentRef} />
            </DrawerContent>
        </Drawer>
    );
});

EditReferenceDialogDrawer.displayName = 'EditReferenceDialogDrawer';

export default EditReferenceDialogDrawer;
