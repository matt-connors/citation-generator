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

const Content = () => {
    return (
        <div className="mx-auto w-full max-w-sm">

        </div>
    )
}

export default function EditReferenceDialogDrawer() {

    const [open, setOpen] = React.useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");

    const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
    const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;
    const DescriptionComponent = isDesktop ? DialogDescription : DrawerDescription;

    const Header = () => {
        return (
            <HeaderComponent>
                <TitleComponent>Edit Citation</TitleComponent>
                <DescriptionComponent>Modify a citation here. Click save when you're done.</DescriptionComponent>
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
                <DialogContent className="sm:max-w-[425px]">
                    <Header />
                    <Content />
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
                <Content />
            </DrawerContent>
        </Drawer>
    )
}