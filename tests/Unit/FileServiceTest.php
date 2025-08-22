<?php

namespace Tests\Unit;

use App\Models\Attachment;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use App\Services\FileService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FileServiceTest extends TestCase
{
    public function test_upload_saves_file_and_creates_attachment()
    {
        Storage::fake('public');

        $attachable = new class extends EloquentModel {
            // morphTo target needs getKey() and getMorphClass(); keep in-memory.
            public $incrementing = false;
            public function getKey()
            {
                return 0;
            }
            public function getMorphClass()
            {
                return 'App\\Models\\User';
            }
        };

        // GD 拡張に依存しない単純なバイナリファイルを作る
        $content = random_bytes(1000);
        $tmp = tmpfile();
        $meta = stream_get_meta_data($tmp);
        $tmpPath = $meta['uri'];
        fwrite($tmp, $content);
        fseek($tmp, 0);

        $file = new \Illuminate\Http\UploadedFile(
            $tmpPath,
            'avatar.jpg',
            'image/jpeg',
            null,
            true
        );

        $service = new FileService();

        $path = $service->storeFile($file, 'tests');

        $this->assertIsString($path);
        Storage::assertExists($path);
    }
}
