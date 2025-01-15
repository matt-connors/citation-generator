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

const Content = ({ source }: { source: Source }) => {
    return (
        <div className="mx-auto w-full w-full">
            <EditCitationForm source={source} />
        </div>
    )
}

export default function EditReferenceDialogDrawer({ source }: { source: Source }) {

    const [open, setOpen] = React.useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");

    const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
    const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;
    const DescriptionComponent = isDesktop ? DialogDescription : DrawerDescription;

    const Header = () => {
        return (
            <HeaderComponent className="mb-2">
                <TitleComponent>Edit Citation</TitleComponent>
                {/* <DescriptionComponent>{source.uuid}</DescriptionComponent> */}
            </HeaderComponent>
        )
    }

    const TriggerButton = () => {
        return (
            <button className="flex gap-[5px] items-center text-[var(--color-text-light)] hover:text-[var(--color-text-primary)]" onClick={() => setOpen(true)}>
                <PencilIcon className="w-[20px] h-[20px]" />
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
                <DialogContent className="">
                    <Header />
                    <Content source={source} />
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
                <div className="p-4">
                    <Content source={source} />
                </div>
            </DrawerContent>
        </Drawer>
    )
}