<html>

<body>
    <p>{{ $name }} 様</p>
    <p>管理者によりアカウントが作成されました。<br>
        以下の情報でログインしてください。</p>
    <br>
    <p>ログインID：{{ $email }}<br>
        仮パスワード：{{ $temporary_password }}
    </p>
    <p>ログインページはこちら<br>
        <a href="{{ $login_url }}">{{ $login_url }}</a>
    </p>

    <br>

    <p>初回ログイン時にパスワードの変更を求められます。<br>
        パスワードの変更を行ってください。</p>
</body>

</html>