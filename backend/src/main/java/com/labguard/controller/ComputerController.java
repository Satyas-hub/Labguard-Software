package com.labguard.controller;

import com.labguard.dto.ComputerDtos.*;
import com.labguard.service.ComputerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ComputerController {

    private final ComputerService computerService;

    @GetMapping("/api/computers/lab/{labId}")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<ComputerDetailDto>> getComputersByLab(@PathVariable UUID labId) {
        List<ComputerDetailDto> list = computerService.getComputersByLab(labId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/api/computers/lab-code/{labCode}")
    @PreAuthorize("@labSecurity.hasLabCodeAccess(authentication, #labCode)")
    public ResponseEntity<List<ComputerDetailDto>> getComputersByLabCode(@PathVariable String labCode) {
        List<ComputerDetailDto> list = computerService.getComputersByLabCode(labCode);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/api/computers/{computerId}")
    public ResponseEntity<ComputerDetailDto> getComputerDetail(@PathVariable UUID computerId) {
        ComputerDetailDto detail = computerService.getComputerDetail(computerId);
        return ResponseEntity.ok(detail);
    }

    /**
     * Windows PC Client Registration Endpoint
     */
    @PostMapping("/api/client/register")
    public ResponseEntity<ComputerDetailDto> registerPc(@Valid @RequestBody RegisterPcRequest request) {
        ComputerDetailDto registered = computerService.registerPc(request);
        return ResponseEntity.ok(registered);
    }

    /**
     * Windows PC Client Heartbeat
     */
    @PostMapping("/api/client/heartbeat")
    public ResponseEntity<HeartbeatResponse> heartbeat(@RequestBody HeartbeatRequest request) {
        HeartbeatResponse response = computerService.processHeartbeat(request);
        return ResponseEntity.ok(response);
    }
}
