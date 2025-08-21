@component('mail::message')
# パスワード再設定のご案内

このメールを受け取いたしましたら、以下のボタンを押してパスワードの再設定手続きを行ってください。

@component('mail::button', ['url' => $actionUrl])
パスワードを再設定する
@endcomponent

もしこのメールに心当たりがない場合は、このメッセージを無視してください。

よろしくお願いいたします。

{{ config('app.name') }}
@endcomponent