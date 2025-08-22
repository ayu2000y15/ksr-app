<?php

namespace App\Services;

use App\Models\Attachment;
use Illuminate\Contracts\Filesystem\Filesystem as FilesystemContract;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class FileService
{
    protected $diskName;
    public function __construct()
    {
        // デフォルトは 'public' を使う。必要であればDIで差し替え可能。
        $this->diskName = config('filesystems.default', 'public');
    }

    /**
     * Upload an uploaded file and create an Attachment record.
     *
     * @param UploadedFile $file
     * @param \Illuminate\Database\Eloquent\Model $attachable
     * @param string|null $pathPrefix
     * @return Attachment
     */
    public function upload(UploadedFile $file, $attachable, ?string $pathPrefix = null): Attachment
    {
        $this->validateFile($file);

        $fullPath = $this->storeFile($file, $pathPrefix);

        // DBレコード作成
        $attachment = new Attachment();
        $attachment->attachable()->associate($attachable);
        $attachment->file_path = $fullPath;
        $attachment->original_name = $file->getClientOriginalName();
        $attachment->save();

        return $attachment;
    }

    /**
     * Store file to disk and return the storage path.
     * Separated for easier testing.
     *
     * @param UploadedFile $file
     * @param string|null $pathPrefix
     * @return string
     */
    public function storeFile(UploadedFile $file, ?string $pathPrefix = null): string
    {
        $prefix = trim((string) $pathPrefix, '/');
        $dir = $prefix === '' ? date('Y/m/d') : ($prefix . '/' . date('Y/m/d'));

        $filename = $this->generateFilename($file);

        $fullPath = $dir . '/' . $filename;

        // 保存
        $stream = fopen($file->getRealPath(), 'r');
        Storage::disk($this->diskName)->writeStream($fullPath, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        return $fullPath;
    }

    /**
     * Return a stream for download or write to response externally.
     *
     * @param Attachment $attachment
     * @return resource|null
     */
    public function getStream(Attachment $attachment)
    {
        $disk = Storage::disk($this->diskName);
        if (!$disk->exists($attachment->file_path)) {
            return null;
        }

        return $disk->readStream($attachment->file_path);
    }

    protected function validateFile(UploadedFile $file): void
    {
        // 最低限のチェック: サイズと拡張子
        $maxBytes = 10 * 1024 * 1024; // 10MB
        if ($file->getSize() > $maxBytes) {
            throw new \Exception('ファイルサイズが大きすぎます');
        }

        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt', 'zip'];
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, $allowed, true)) {
            throw new \Exception('許可されていないファイル形式です');
        }
    }

    protected function generateFilename(UploadedFile $file): string
    {
        $hash = bin2hex(random_bytes(8));
        $ext = $file->getClientOriginalExtension();
        $safe = preg_replace('/[^A-Za-z0-9_\-]/', '_', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        return $safe . '_' . time() . '_' . $hash . '.' . $ext;
    }
}
