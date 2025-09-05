<?php

namespace App\Models;

use App\Models\BaseModel;
use Illuminate\Support\Facades\Storage;

class Attachment extends BaseModel
{
    protected $fillable = ['file_path', 'original_name'];
    // append computed size to JSON output
    protected $appends = ['size'];

    public function attachable()
    {
        return $this->morphTo();
    }

    /**
     * Return file size in bytes if available, otherwise null.
     * This will be included in serialized JSON as `size`.
     */
    public function getSizeAttribute()
    {
        $path = $this->file_path ?? null;
        if (!$path) return null;
        try {
            if (Storage::disk('public')->exists($path)) {
                return Storage::disk('public')->size($path);
            }
        } catch (\Throwable $e) {
            // ignore and return null on error
        }
        return null;
    }
}
