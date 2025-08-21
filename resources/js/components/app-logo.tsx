import AppLogoIcon from './app-logo-icon';

export const AppLogo = () => {
    // 環境変数からアプリケーション名を取得
    const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <AppLogoIcon className="size-5 fill-current text-white dark:text-black" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-tight font-semibold">{appName}</span>
            </div>
        </>
    );
};
