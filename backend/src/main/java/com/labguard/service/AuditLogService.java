package com.labguard.service;

import com.labguard.dto.AnalyticsDtos.AuditLogDto;
import com.labguard.entity.AuditLog;
import com.labguard.entity.Lab;
import com.labguard.entity.User;
import com.labguard.repository.AuditLogRepository;
import com.labguard.repository.LabRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final LabRepository labRepository;

    @Transactional
    public void logAction(User user, String action, String entity, String entityId, UUID labId, String metadata) {
        Lab lab = labId != null ? labRepository.findById(labId).orElse(null) : null;
        AuditLog log = AuditLog.builder()
            .user(user)
            .action(action)
            .entity(entity)
            .entityId(entityId)
            .lab(lab)
            .timestamp(OffsetDateTime.now())
            .metadata(metadata)
            .build();
        auditLogRepository.save(log);
    }

    @Transactional
    public void logAction(User user, String action, String entity, String entityId, UUID labId, Object metadataObj) {
        String metadata = metadataObj != null ? String.valueOf(metadataObj) : null;
        logAction(user, action, entity, entityId, labId, metadata);
    }

    public List<AuditLogDto> getAllLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    public List<AuditLogDto> getLogsByLab(UUID labId) {
        return auditLogRepository.findByLabIdOrderByTimestampDesc(labId).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    private AuditLogDto toDto(AuditLog log) {
        return AuditLogDto.builder()
            .id(log.getId())
            .userFullName(log.getUser() != null ? log.getUser().getFullName() : "System Automation")
            .userEmail(log.getUser() != null ? log.getUser().getEmail() : "system@labguard.local")
            .userRole(log.getUser() != null ? log.getUser().getRole().getName() : "SYSTEM")
            .action(log.getAction())
            .entity(log.getEntity())
            .entityId(log.getEntityId())
            .labCode(log.getLab() != null ? log.getLab().getCode() : "GLOBAL")
            .ipAddress(log.getIpAddress())
            .timestamp(log.getTimestamp())
            .metadata(log.getMetadata())
            .build();
    }
}
