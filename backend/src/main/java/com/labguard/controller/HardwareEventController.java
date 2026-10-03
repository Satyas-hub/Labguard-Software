package com.labguard.controller;

import com.labguard.dto.HardwareDtos.*;
import com.labguard.service.HardwareEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/hardware-events")
@RequiredArgsConstructor
public class HardwareEventController {

    private final HardwareEventService hardwareEventService;

    @GetMapping("/lab/{labId}")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<HardwareEventDetailDto>> getEventsByLab(@PathVariable UUID labId) {
        List<HardwareEventDetailDto> list = hardwareEventService.getEventsByLab(labId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/recent")
    @PreAuthorize("hasAnyRole('ADMIN', 'LAB_ASSISTANT')")
    public ResponseEntity<List<HardwareEventDetailDto>> getRecentEvents() {
        return ResponseEntity.ok(hardwareEventService.getRecentEvents());
    }

    /**
     * Windows Client sends peripheral connect/disconnect events
     */
    @PostMapping("/report")
    public ResponseEntity<HardwareEventDetailDto> reportHardwareEvent(@Valid @RequestBody ReportHardwareEventRequest request) {
        HardwareEventDetailDto recorded = hardwareEventService.recordHardwareEvent(request);
        return ResponseEntity.ok(recorded);
    }
}
