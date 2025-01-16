import React from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "./Drawer"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./Dialog"
import { PencilIcon } from "@heroicons/react/24/outline"
import { useMediaQuery } from '@react-hook/media-query'
import { Button } from "./Button"
import EditCitationForm from "./EditCitationForm"
import type { Source } from '../../lib/citations/definitions';
import { ScrollArea } from "./ScrollArea";
import { Line } from "./EditCitationFormComponents"
import { Check, Pencil, RefreshCw } from "lucide-react"

const Content = ({ source, setSources }: { source: Source, setSources: (sources: Source[]) => void }) => {
    return (
        <ScrollArea className="mx-auto w-full w-full max-h-[65vh] h-full p-8 pt-0 pb-0">
            <EditCitationForm source={source} setSources={setSources} />
            <Line className="my-8" />
            <div className="flex gap-2 items-center pb-8 text-muted-foreground ">
                <RefreshCw size={16} strokeWidth={1.8} />
                <p className="text-xs leading-none">All changes are saved automatically.</p>
            </div>
        </ScrollArea>
    )
}

export default function EditReferenceDialogDrawer({ source, setSources }: { source: Source, setSources: (sources: Source[]) => void }) {

    const [open, setOpen] = React.useState(false);
    const isDesktop = useMediaQuery("(min-width: 900px)");

    const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
    const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;
    const DescriptionComponent = isDesktop ? DialogDescription : DrawerDescription;

    const Header = () => {
        return (
            <HeaderComponent className="m-0 p-5 px-8 shadow-sm border-b border-border border-b-solid">
                <TitleComponent>Edit Citation</TitleComponent>
                {/* <DescriptionComponent className="text-xs">{source.uuid}</DescriptionComponent> */}
            </HeaderComponent>
        )
    }

    const TriggerButton = () => {
        return (
            <button className="flex gap-[5px] items-center text-[var(--color-text-light)] hover:text-[var(--color-text-primary)]" onClick={() => setOpen(true)}>
                <Pencil className="w-[20px] h-[20px]" />
                <span>Edit</span>
            </button>
        )
    }

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <TriggerButton />
                </DialogTrigger>
                <DialogContent className="p-0">
                    <Header />
                    <Content source={source} setSources={setSources} />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <TriggerButton />
            </DrawerTrigger>
            <DrawerContent>
                <Header />
                <Content source={source} setSources={setSources} />
            </DrawerContent>
        </Drawer>
    )
}