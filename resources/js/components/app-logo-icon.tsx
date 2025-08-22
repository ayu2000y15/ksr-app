import type { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    // public 配下の images/ksr_logo.jpg を参照します。
    return <img {...props} src="/ksr_logo.jpg" alt="ksr logo" />;
}
